import { useState, useEffect, useMemo } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

function BidsTable() {

  return (
    <div>
    </div>
  );
}

export const Bids = () => (
  <BrowserOnly fallback={<div>Loading...</div>}>
    {() => <BidsTable />}
  </BrowserOnly>
);

export default Bids;
