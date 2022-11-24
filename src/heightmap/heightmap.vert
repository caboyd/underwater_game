#version 300 es
precision highp float;

layout (location = 0) in vec2 position;
layout (location = 1) in uvec2 chunk_coord;

layout (std140) uniform ubo_per_frame{
                          // base alignment   // aligned offset
    mat4 view;            // 64               // 0
    mat4 view_inverse;    // 64               // 64
    mat4 projection;      // 64               // 128
    mat4 view_projection; // 64               // 192
    mat4 shadow_map_space;// 64               // 256

};

layout (std140) uniform ubo_per_model{
                        // base alignment   // aligned offset
    mat4 model;         // 64               // 0
    mat3 normal_view;   // 64               // 64
    mat4 mvp;           // 64               // 128
};

struct Light {
    vec4 position;
    vec3 color;
};

uniform int u_light_count;
uniform Light u_lights[16];
uniform float shadow_distance;
uniform float transition_distance;

//height map uniforms
uniform sampler2D u_height_map_sampler;
uniform bool is_floor;
uniform float u_tex_cells;
uniform float u_cells;
uniform float u_chunk_width;

out vec3 view_pos;
out vec3 world_pos;
out vec2 tex_coord;
out vec3 view_normal;
out vec3 world_normal;
out vec3 camera_pos;
out vec4 shadow_coord;

vec3 inverseTransformDirection(in vec3 normal, in mat4 matrix) {
    return normalize( (vec4(normal,0.0) * matrix).xyz );
}

void main() {

    tex_coord = u_tex_cells * position / u_cells;

    vec2 instance_xz = vec2(float(chunk_coord.x) * u_chunk_width, float(chunk_coord.y) * u_chunk_width);

    vec2 world_xz  = instance_xz +  position;
    vec2 world_x1z = instance_xz + vec2(position.x + 1.0, position.y);
    vec2 world_xz1 = instance_xz +  vec2(position.x, position.y + 1.0);
    vec2 rg  = texture(u_height_map_sampler, world_xz / 1600.0).rg;
    vec2 rg1 = texture(u_height_map_sampler, world_x1z / 1600.0).rg;
    vec2 rg2 = texture(u_height_map_sampler, world_xz1 / 1600.0).rg;
    
    float y,y1,y2;
    if(is_floor){
        y  = rg.g;
        y1 = rg1.g;
        y2 = rg2.g;
    }else{
        y  = rg.r;
        y1 = rg1.r;
        y2 = rg2.r;
    }

    world_pos = vec3(world_xz.x, y, world_xz.y);
    vec3 world_pos1 = vec3(world_x1z.x, y1, world_x1z.y);
    vec3 world_pos2 = vec3(world_xz1.x, y2, world_xz1.y);

    vec3 normal = normalize(cross(world_pos2 - world_pos,world_pos1 - world_pos));
    if (is_floor) {
        world_normal = normal;
    } else {
        world_normal = -normal;
    }
    //world_normal = vec3(0,1,0);

    vec4 wp = model * vec4(world_pos, 1.0);
    world_pos = wp.xyz;
    gl_Position = mvp * wp;

    camera_pos = view_inverse[3].xyz;
    view_pos = (view * wp).xyz ;
    view_normal =  (view * vec4(world_normal,1.0)).xyz ;
   
    //(OUT) Calculate world space coords that map this vertex to the shadow_map
    //The vertex may not appear in the shadow_map and will have no shadow

    vec3 toLight = normalize(u_lights[0].position.xyz);
    float cos_light_angle = dot(toLight, world_normal);
    float slope_scale = clamp(1.0 - cos_light_angle, 0.0, 1.0);
    float normal_offset_scale =  slope_scale * 0.4;
    vec4 shadow_offset = vec4(world_normal * normal_offset_scale,0.0);
    shadow_coord = shadow_map_space * (wp + shadow_offset);

    //shadow_coord = shadow_map_space * wp;

    //Shadow_coord.w will be used to fade in and out shadows softly when they are far from camera
    //doing this per vertex doesnt work well for objects with one vertex inside and one outside when they are large
    float distance1 = length(camera_pos - world_pos);

    distance1 = distance1 - (shadow_distance - transition_distance);
    distance1 = distance1 / transition_distance;
    shadow_coord.w = clamp(1.0 - distance1, 0.0, 1.0);
}