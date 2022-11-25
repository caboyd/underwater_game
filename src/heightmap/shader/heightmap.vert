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
uniform bool is_ceiling;
uniform float u_tex_cells;
uniform float u_cells;
uniform float u_chunk_width;
uniform float u_chunks;

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

    float scale = u_chunk_width / u_cells;
    vec2 chunk_xz = vec2(chunk_coord);
    vec2 world_xz  = scale * (chunk_xz * u_cells + position);

    vec2 sample_xz  = (chunk_xz + (position / u_cells)) / u_chunks;   
    float texel =  1.0 / (u_cells * u_chunks);
    const ivec3 off = ivec3(-1, 0, 1);

    vec2 rg         = texture(u_height_map_sampler, sample_xz).rg;
    vec2 rg_left    = textureOffset(u_height_map_sampler,sample_xz, off.xy).rg;
    vec2 rg_right   = textureOffset(u_height_map_sampler,sample_xz, off.zy).rg;
    vec2 rg_top     = textureOffset(u_height_map_sampler,sample_xz, off.yx).rg;
    vec2 rg_bottom  = textureOffset(u_height_map_sampler,sample_xz, off.yz).rg;
    
    float y,y_right,y_bottom,y_left,y_top;

    if(is_ceiling){
        y = rg.r;
        y_right = rg_right.r;
        y_bottom = rg_bottom.r;
        y_left = rg_left.r;
        y_top = rg_top.r;
    }else{
        y = rg.g;
        y_right = rg_right.g;
        y_bottom = rg_bottom.g;
        y_left = rg_left.g;
        y_top = rg_top.g;
    }

    vec4 wp = model * vec4(world_xz.x, y, world_xz.y, 1.0);
    world_pos =  wp.xyz;
    
    float factor =  (u_chunk_width / u_cells);
    vec3 world_right  = vec3(world_pos.x + factor, y_right , world_pos.z         );
    vec3 world_bottom = vec3(world_pos.x         , y_bottom, world_pos.z + factor);
    vec3 world_left   = vec3(world_pos.x - factor, y_left  , world_pos.z         );
    vec3 world_top    = vec3(world_pos.x         , y_top   , world_pos.z - factor);

    float factor2 = factor * 2.0;
    if (is_ceiling) {
       // world_normal = -normalize(vec3((y_left-y_right) / factor2, 1.0, (y_bottom-y_top) / factor2));
        world_normal =  normalize(cross(world_right - world_left, world_bottom - world_top ));
    } else {

         //world_normal = normalize(vec3((y_right-y_left) / factor2, 1.0, (y_bottom-y_top) / factor2 ));
        world_normal =  -normalize(cross(world_right - world_left, world_bottom - world_top ));
        //world_normal =  normalize(cross(world_bottom - world_top, world_right - world_left ));
    }

    gl_Position = view_projection * wp;

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