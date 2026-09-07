import { useId, useState, type ReactNode } from "react";

/** Keep detail state when folded; mount expensive charts only after first expansion. */
export default function Disclosure({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  return (
    <section className="disclosure">
      <button type="button" className="disclosure-toggle" aria-expanded={open} aria-controls={id}
        onClick={() => { setVisited(true); setOpen(!open); }}>
        <span><span className="disclosure-title">{title}</span>
          {description && <span className="disclosure-description">{description}</span>}</span>
        <span className="disclosure-action">{open ? "접기 −" : "자세히 +"}</span>
      </button>
      <div id={id} hidden={!open} className="disclosure-content">{visited ? children : null}</div>
    </section>
  );
}
