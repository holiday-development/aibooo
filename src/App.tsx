import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');

  async function improveText() {
    try {
      const improved = await invoke<string>('improve_text', {
        text: inputText,
      });
      setOutputText(improved);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="container">
      <h1>Write Better</h1>
      <p>メール文章を改善するツール</p>

      <div className="row">
        <div>
          <h2>元の文章</h2>
          <textarea
            id="input-text"
            onChange={(e) => setInputText(e.target.value)}
            value={inputText}
            rows={10}
            placeholder="ここに文章を入力してください"
          />
        </div>

        <div className="buttons">
          <button type="button" onClick={improveText}>
            変換 →
          </button>
        </div>

        <div>
          <h2>改善された文章</h2>
          <textarea
            id="output-text"
            value={outputText}
            rows={10}
            readOnly
            placeholder="ここに改善された文章が表示されます"
          />
        </div>
      </div>

      <p className="instruction">
        <b>使い方：</b> Cmd+C でコピーした文章を、もう一度 Cmd+C
        を押すことで自動的に改善します。
        <br />
        改善された文章は自動的にクリップボードにコピーされます。
      </p>
    </div>
  );
}

export default App;
