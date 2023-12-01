import { PageProps, Plugin } from "https://deno.land/x/fresh@1.5.4/server.ts";
import TestComponent from "../routes/session_test_route.tsx";
import { ComponentType } from "preact";
export const testPlugin: Plugin = {
  name: "TestPlugin",
  routes: [
    {
      component: TestComponent as ComponentType<PageProps>,
      path: "/session",
    },
  ],
};
