import { useState, useEffect, useMemo } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

function FilesTable() {

  return (
    <div>
    </div>
  );
}

export const Files = () => (
  <BrowserOnly fallback={<div>Loading...</div>}>
    {() => <FilesTable />}
  </BrowserOnly>
);

export default Files;
