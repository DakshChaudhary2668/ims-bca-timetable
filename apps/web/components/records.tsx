"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  resources,
  rowLabel,
  type Data,
  type Resource,
  type Row,
} from "../lib/resources";
import { Button } from "./ui/button";

type Editor = { mode: "add" } | { mode: "edit" | "delete"; row: Row };

export function Records({ name, data }: { name: Resource; data: Data }) {
  const definition = resources[name];
  const rows = data[name] ?? [];
  const router = useRouter();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (editor && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [editor]);

  function open(next: Editor) {
    const row = next.mode === "add" ? undefined : next.row;
    setValues(
      Object.fromEntries(
        definition.fields.map((field) => {
          const value = String(
            row ? (row[field.key] ?? "") : (field.defaultValue ?? ""),
          );
          return [
            field.key,
            field.kind === "date" ? value.slice(0, 10) : value,
          ];
        }),
      ),
    );
    setError("");
    setFeedback("");
    setEditor(next);
  }

  function options(field: (typeof definition.fields)[number]) {
    if (!field.ref) return [];
    const candidates = data[field.ref] ?? [];
    return field.key !== "semesterId" &&
      "semesterId" in values &&
      field.ref !== "faculty"
      ? candidates.filter((row) => row.semesterId === values.semesterId)
      : candidates;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    try {
      const deleting = editor.mode === "delete";
      const body = Object.fromEntries(
        definition.fields.map(({ key, kind, optional }) => {
          const value = values[key];
          if (optional && value === "") return [key, null];
          if (kind === "number") return [key, Number(value)];
          if (kind === "boolean") return [key, value === "true"];
          return [key, value];
        }),
      );
      const response = await fetch(
        `/api/${name}${editor.mode === "add" ? "" : `/${editor.row.id}`}`,
        {
          method: deleting ? "DELETE" : editor.mode === "edit" ? "PUT" : "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${sessionStorage.getItem("ims-operator-key") ?? ""}`,
          },
          ...(deleting
            ? {}
            : {
                body: JSON.stringify(body),
              }),
        },
      );
      if (!response.ok) {
        const payload = await response.json();
        const issue = payload.error?.issues?.[0];
        const label = definition.fields.find(
          (field) => field.key === issue?.field,
        )?.label;
        setError(
          issue
            ? `${label ? `${label} — ` : ""}${issue.message}`
            : (payload.error?.message ?? "Unable to save this change."),
        );
        return;
      }
      dialog.current?.close();
      setFeedback(deleting ? "Record deleted." : "Record saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the academic records service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="records" id={name} aria-labelledby={`${name}-title`}>
      <div className="records-header">
        <div>
          <h2 id={`${name}-title`}>{definition.title}</h2>
          <p>
            {rows.length
              ? `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`
              : definition.empty}
          </p>
        </div>
        <Button variant="outline" onClick={() => open({ mode: "add" })}>
          <span aria-hidden="true">+</span> Add {definition.singular}
        </Button>
      </div>
      <div role="status" className={feedback ? "feedback" : "sr-only"}>
        {feedback}
      </div>
      {rows.length > 0 && (
        <div className="table-wrap">
          <table aria-labelledby={`${name}-title`}>
            <thead>
              <tr>
                {definition.fields.map((field) => (
                  <th
                    key={field.key}
                    scope="col"
                    className={field.kind === "number" ? "numeric" : undefined}
                  >
                    {field.label}
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {definition.fields.map((field) => {
                    const value = row[field.key];
                    const related =
                      field.ref &&
                      data[field.ref]?.find((option) => option.id === value);
                    const display =
                      related && field.ref
                        ? rowLabel(field.ref, related, data)
                        : value == null
                          ? field.key === "sectionId"
                            ? "All sections (default)"
                            : "Unset"
                          : field.kind === "date"
                            ? String(value).slice(0, 10)
                            : field.kind === "boolean"
                              ? value
                                ? "Yes"
                                : "No"
                              : String(value);
                    return (
                      <td
                        key={field.key}
                        className={
                          field.kind === "number" ? "numeric" : undefined
                        }
                      >
                        {display}
                      </td>
                    );
                  })}
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        onClick={() => open({ mode: "edit", row })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => open({ mode: "delete", row })}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setEditor(null)}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {editor && (
          <form onSubmit={save}>
            <h2 id={titleId}>
              {editor.mode === "delete"
                ? "Delete"
                : editor.mode === "edit"
                  ? "Edit"
                  : "Add"}{" "}
              {definition.singular}
            </h2>
            {editor.mode === "delete" ? (
              <p>
                Delete this {definition.singular} from the register? This action
                cannot be undone.
              </p>
            ) : (
              <div className="form-grid">
                {definition.fields.map((field) => {
                  const { key, label, kind, ref, optional, min, max } = field;
                  const available = options(field);
                  function change(value: string) {
                    setValues((previous) => {
                      const next = { ...previous, [key]: value };
                      if (key === "semesterId") {
                        for (const dependent of definition.fields) {
                          if (
                            dependent.ref &&
                            ["sections", "subjects", "student-groups"].includes(
                              dependent.ref,
                            )
                          )
                            next[dependent.key] = "";
                        }
                      }
                      return next;
                    });
                  }
                  return (
                    <label key={key}>
                      {label}
                      {optional && (
                        <span className="optional"> (optional)</span>
                      )}
                      {ref || kind === "boolean" ? (
                        <select
                          required={!optional}
                          value={values[key]}
                          onChange={(event) => change(event.target.value)}
                        >
                          {kind === "boolean" ? (
                            <>
                              {optional && (
                                <option value="">Unconfirmed</option>
                              )}
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </>
                          ) : (
                            <>
                              <option value="">
                                {optional
                                  ? "All sections (default)"
                                  : available.length
                                    ? "Choose…"
                                    : "No matching records"}
                              </option>
                              {ref &&
                                available.map((row) => (
                                  <option key={row.id} value={row.id}>
                                    {rowLabel(ref, row, data)}
                                  </option>
                                ))}
                            </>
                          )}
                        </select>
                      ) : (
                        <input
                          type={kind ?? "text"}
                          min={min}
                          max={max}
                          required={!optional}
                          value={values[key]}
                          onChange={(event) => change(event.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={editor.mode === "delete" ? "destructive" : "default"}
                disabled={busy}
              >
                {busy
                  ? "Working…"
                  : editor.mode === "delete"
                    ? "Delete record"
                    : "Save record"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
