import Link from "next/link";
import { EmptyState } from "@/components/Bits";

export default function NotFound() {
  return (
    <EmptyState mood="confused" title="This table is empty" action={<Link className="btn" href="/">Back to the shelf</Link>}>
      The page you were looking for is not here. Maybe it was put back in the box.
    </EmptyState>
  );
}
