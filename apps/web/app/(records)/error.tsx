"use client";

import { Button } from "../../components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="notice">
      <h1>Academic records are unavailable</h1>
      <p>Check that the API and database are running, then try again.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
