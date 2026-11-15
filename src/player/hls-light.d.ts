// hls.js ships no types for the light build; it has the same API as the full one.
declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
