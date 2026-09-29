export function withAtlas<H extends (...args: never[]) => unknown>(handler: H): H { return handler; }
