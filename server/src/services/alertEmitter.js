import { EventEmitter } from "events";
const emitter = new EventEmitter();
emitter.setMaxListeners(500); // allow many concurrent SSE connections
export default emitter;
