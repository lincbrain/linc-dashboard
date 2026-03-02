import { useState, useEffect, useMemo } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

function SummaryTable() {

  return (
    <div>
    </div>
  );
}

export const Summary = () => (
  <BrowserOnly fallback={<div>Loading...</div>}>
    {() => <SummaryTable />}
  </BrowserOnly>
);

export default Summary;
