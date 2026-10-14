import { useState } from 'react';
import { calculate } from '../engine/calculator';
import { Modal } from './Common';
export function Calculator({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState(''),
    [error, setError] = useState('');
  function evaluate() {
    try {
      setValue(String(calculate(value)));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Virtual calculator" onClose={onClose}>
      <p className="small text-secondary">Trigonometry uses radians. Use ^ for powers.</p>
      <label className="form-label">
        Expression
        <input
          autoFocus
          className="form-control calculator-display"
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') evaluate();
          }}
        />
      </label>
      <div className="calculator-keys">
        {[
          'sin(',
          'cos(',
          'tan(',
          'sqrt(',
          'log(',
          'ln(',
          '(',
          ')',
          '7',
          '8',
          '9',
          '/',
          '4',
          '5',
          '6',
          '*',
          '1',
          '2',
          '3',
          '-',
          '0',
          '.',
          'pi',
          '+',
        ].map((k) => (
          <button
            className="btn btn-light"
            key={k}
            onClick={() => setValue((v) => (v + k).slice(0, 200))}
          >
            {k}
          </button>
        ))}
        <button
          className="btn btn-outline-secondary"
          onClick={() => {
            setValue('');
            setError('');
          }}
        >
          C
        </button>
        <button className="btn btn-light" onClick={() => setValue((v) => v.slice(0, -1))}>
          ⌫
        </button>
        <button className="btn btn-light" onClick={() => setValue((v) => v + '^')}>
          xʸ
        </button>
        <button className="btn btn-primary" onClick={evaluate}>
          =
        </button>
      </div>
      {error && (
        <p className="text-danger mt-3" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
