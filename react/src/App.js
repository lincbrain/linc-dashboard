import './App.css';

function App() {
  return (
    <div className="App"  style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <iframe
          src="https://linc-dashboard.streamlit.app/?embed=true"
          height="100%"
          width="100%"
          title="LINC Dashboard"
        ></iframe>
    </div>
  );
}

export default App;
