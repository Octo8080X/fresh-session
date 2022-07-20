import { MiddlewareHandlerContext } from "$fresh/server.ts";

export type State = {};

export function handler(
  _req: Request,
  ctx: MiddlewareHandlerContext<State>,
) {
  console.log("middleware nested");
  return ctx.next();
}
