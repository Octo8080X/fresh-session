import { PageProps } from "$fresh/server.ts";
import type { WithSession } from "../../mod.ts";

export default function Home(
  props: PageProps<unknown, WithSession<"count", "">>,
) {
  const count = props.state.session.get("count") || 0;
  props.state.session.set("count", Number(count) + 1);

  return (
    <div>
      <p>count:{count}</p>
    </div>
  );
}
