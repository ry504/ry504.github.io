/* Image-based sculpture rendered with a live WebGL fragment shader. */
(() => {
  'use strict';
  const source = document.querySelector('[data-statue-img]');
  if (!source) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'sculpture-shader';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none'
  });
  const textureSource = new Image();
  textureSource.src = source.src;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return;
  const vertex = `attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){ v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;
  const fragment = `precision highp float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_reveal;
    uniform float u_pixel;
    uniform vec2 u_pointer;
    uniform float u_hover;
    varying vec2 v_uv;
    float bayer2(vec2 p){ vec2 q=mod(p,2.); return 2.*q.x+3.*q.y-4.*q.x*q.y; }
    float bayer4(vec2 p){ return (4.*bayer2(p)+bayer2(floor(p/2.))+.5)/16.; }
    float bayer8(vec2 p){ return (4.*(bayer4(p)*16.-.5)+bayer2(floor(p/4.))+.5)/64.; }
    void main(){
      // Contiguous binary pixels on an integer framebuffer lattice; 64 tonal thresholds.
      // Continuous-tone texture is sampled once; no baked-in dithering or random noise.
      vec2 grid = u_resolution / u_pixel;
      vec2 latticeUV = vec2(v_uv.x, 1. - v_uv.y);
      vec2 cell = floor(vec2(gl_FragCoord.x, u_resolution.y-gl_FragCoord.y) / u_pixel);
      vec2 sampleUV = (cell + .5) / grid;
      vec3 sampled = texture2D(u_image, sampleUV).rgb;
      float light = dot(sampled,vec3(.299,.587,.114));
      light = pow(clamp((light-.025)*1.13,0.,1.),.95);
      // Move only the threshold matrix horizontally; source samples and alpha stay fixed.
      vec2 pointerDelta = (latticeUV-u_pointer)*grid;
      // Uneven, elongated falloff with no hard circular boundary.
      vec2 field = pointerDelta / vec2(62.,38.);
      field.x += .24*sin(field.y*2.7 + cell.y*.031);
      field.y += .19*sin(field.x*3.1 - cell.x*.027);
      float influence = exp(-dot(field,field)*1.25);
      // Incommensurate row waves avoid a repeated stamped footprint.
      float flow = .55*sin(cell.y*.071 + u_pointer.x*9.)
                 + .29*sin(cell.y*.173 - u_pointer.y*13. + cell.x*.017)
                 + .16*sin(cell.y*.317 + u_pointer.x*7.);
      float displacement = flow * 3.2 * influence * u_hover;
      vec2 patternCell = cell + vec2(floor(displacement+.5),0.);
      float threshold = bayer8(patternCell);
      float dither = step(threshold,light) * step(.025,light);
      float reveal = step(threshold, u_reveal);
      vec3 ivory = vec3(.91,.90,.85);
      vec3 red = vec3(1.,.275,.333);
      // Crisp back-edge rim, derived from the source silhouette on the same lattice.
      float outside = dot(texture2D(u_image, sampleUV-vec2(2.5/grid.x,0.)).rgb,vec3(.299,.587,.114));
      float silhouette = step(outside,.035) * step(.04,light);
      float backEdge = silhouette * (1.-smoothstep(.48,.60,sampleUV.x));
      float redMix = backEdge;
      vec3 ink = mix(ivory,red,redMix);
      float bottomFade = 1.-smoothstep(.91,1.,latticeUV.y);
      float intensity = dither * reveal * step(threshold,bottomFade);
      float alpha = smoothstep(.015,.04,dot(sampled,vec3(.299,.587,.114)));
      alpha *= bottomFade;
      gl_FragColor = vec4(ink*intensity*alpha,alpha);
    }`;
  function compile(type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader); throw new Error('Sculpture shader compilation failed');
    }
    return shader;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Sculpture shader linking failed');
  } catch (error) { console.warn(error.message); return; }
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program,'a_position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uniforms = Object.fromEntries(['image','resolution','reveal','pixel','pointer','hover'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let ready=false, visible=true, frame=0, elapsed=0, last=0;
  const pointer = { x: .5, y: .5 };
  let hover = 0, pointerFrame = 0;
  function motionEnabled(){ return !reduceMotion.matches; }
  function resize(){
    const rect=source.getBoundingClientRect();
    const scale=Math.min(devicePixelRatio || 1,1.5);
    canvas.width=Math.max(1,Math.round(rect.width*scale));
    canvas.height=Math.max(1,Math.round(rect.height*scale));
    gl.viewport(0,0,canvas.width,canvas.height);
    draw(0);
  }
  function draw(now){
    if(!ready) return;
    const active=motionEnabled();
    if(active && last && now) elapsed+=Math.min((now-last)/1000,.06);
    if(now) last=now;
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
    gl.uniform1f(uniforms.pixel,Math.max(1,Math.round(2.0 * canvas.width / Math.max(1,source.getBoundingClientRect().width))));
    gl.uniform1f(uniforms.reveal,active?Math.min(1,elapsed/1.5):1);
    gl.uniform2f(uniforms.pointer,pointer.x,pointer.y);
    gl.uniform1f(uniforms.hover,active?hover:0);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function tick(now){ frame=0; draw(now); if(visible&&!document.hidden&&motionEnabled()&&elapsed<1.6) frame=requestAnimationFrame(tick); }
  function schedule(){ cancelAnimationFrame(frame); frame=0; last=0; draw(0); if(ready&&visible&&!document.hidden&&motionEnabled()&&elapsed<1.6) frame=requestAnimationFrame(tick); }
  function start(){
    if(ready||!textureSource.naturalWidth) return;
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureSource);
    source.parentElement.appendChild(canvas);
    ready=true; resize(); source.style.opacity='0';
    canvas.dataset.renderer='webgl';
    new ResizeObserver(resize).observe(source);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();}).observe(canvas);
    schedule();
  }
  const hero = source.closest('.hero');
  function refreshPointer() {
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (visible && !document.hidden) draw(0);
    });
  }
  hero?.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !motionEnabled()) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX-rect.left)/rect.width;
    pointer.y = (event.clientY-rect.top)/rect.height;
    hover = 1;
    refreshPointer();
  }, {passive:true});
  hero?.addEventListener('pointerleave', () => { hover=0; refreshPointer(); }, {passive:true});
  // A scroll moves the canvas away from a stationary cursor; clear stale interaction.
  addEventListener('scroll', () => { if(hover){ hover=0; refreshPointer(); } }, {passive:true});
  document.addEventListener('visibilitychange',schedule);
  reduceMotion.addEventListener('change',schedule);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);ready=false;canvas.remove();source.style.opacity='';});
  if(textureSource.complete)start();else textureSource.addEventListener('load',start,{once:true});
})();
