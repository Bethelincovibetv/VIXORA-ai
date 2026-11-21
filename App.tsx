import React, { useEffect, useState } from 'react';
import { getPersistedVideoHistory, persistVideoHistory } from './services/dataSyncService';

const App: React.FC = () => {
  const [videoHistory, setVideoHistory] = useState([]);

  useEffect(() => {
    const savedHistory = getPersistedVideoHistory();
    setVideoHistory(savedHistory);
  }, []);

  useEffect(() => {
    if (videoHistory.length > 0) {
      persistVideoHistory(videoHistory);
    }
  }, [videoHistory]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-4">VIXORA AI Studio</h1>
        {/* App content components */}
      </main>
    </div>
  );
};

export default App;