import React, { useMemo } from "react";
import { highlightDiff } from "./changes-diff-highlighting";

export function DiffText({ value }: { value: string }): React.JSX.Element {
  const highlightedDiff = useMemo(() => highlightDiff(value), [value]);

  if (highlightedDiff.mode === "plain") {
    return <pre className="changes-diff__code">{highlightedDiff.text}</pre>;
  }

  return (
    <pre className="changes-diff__code">
      {highlightedDiff.lines.map((line, index) => (
        <span
          key={`${line.kind}:${index}`}
          className={`changes-diff__line changes-diff__line--${line.kind}`}
        >
          {line.text}
          {index < highlightedDiff.lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </pre>
  );
}
