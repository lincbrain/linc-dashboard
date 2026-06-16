import BrowserOnly from "@docusaurus/BrowserOnly";

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
