import { createFileRoute } from "@tanstack/react-router";
import { TetraApp } from "@/components/tetra/TetraApp";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <TetraApp />;
}
