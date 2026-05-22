import React, { useState } from 'react';

/**
 * ReturnModal - a reusable modal for return or exchange requests.
 * Props:
 *   isOpen: boolean – controls visibility
 *   onClose: () => void – callback to close the modal
 *   orderId: string – id of the order being processed
 *   type: 'RETURN' | 'EXCHANGE' – request type
 *   reasons: string[] – list of reason strings to choose from
 *   onSubmit: (payload: { reason: string; remarks: string; checklist?: string[] }) => void
 */
export default function ReturnModal({
  isOpen,
  onClose,
  orderId,
  type,
  reasons,
  onSubmit,
}) {
  const [selectedReason, setSelectedReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [checklist, setChecklist] = useState([]);

  const toggleChecklistItem = (item) => {
    setChecklist((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = () => {
    if (!selectedReason) {
      alert('Please select a reason.');
      return;
    }
    onSubmit({ reason: selectedReason, remarks, checklist });
    // Reset local state for next use
    setSelectedReason('');
    setRemarks('');
    setChecklist([]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={backdropStyle}>
      <div className="modal" style={modalStyle}>
        <h2 style={headerStyle}>{type === 'RETURN' ? 'Return' : 'Exchange'} Request</h2>
        <p style={subHeaderStyle}>Order ID: {orderId}</p>
        <div style={sectionStyle}>
          <p style={labelStyle}>Select a reason:</p>
          {reasons.map((r) => (
            <label key={r} style={radioLabelStyle}>
              <input
                type="radio"
                name="reason"
                value={r}
                checked={selectedReason === r}
                onChange={() => setSelectedReason(r)}
                style={radioInputStyle}
              />
              {r}
            </label>
          ))}
        </div>
        <div style={sectionStyle}>
          <p style={labelStyle}>Additional remarks (optional):</p>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            style={textareaStyle}
          />
        </div>
        {/* Simple checklist – can be extended later */}
        <div style={sectionStyle}>
          <p style={labelStyle}>Checklist (optional):</p>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={checklist.includes('Item not used')}
              onChange={() => toggleChecklistItem('Item not used')}
            />
            Item not used
          </label>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={checklist.includes('Original packaging intact')}
              onChange={() => toggleChecklistItem('Original packaging intact')}
            />
            Original packaging intact
          </label>
        </div>
        <div style={buttonContainerStyle}>
          <button onClick={onClose} style={buttonStyle}>Cancel</button>
          <button onClick={handleSubmit} style={{ ...buttonStyle, backgroundColor: '#22c55e' }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline styles – using vanilla CSS concepts for quick preview
const backdropStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  width: '90%',
  maxWidth: '420px',
  padding: '1.5rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const headerStyle = { margin: 0, fontSize: '1.5rem', color: '#111827' };
const subHeaderStyle = { margin: '0.5rem 0 1rem', color: '#6b7280' };
const sectionStyle = { marginBottom: '1rem' };
const labelStyle = { marginBottom: '0.5rem', fontWeight: '500' };
const radioLabelStyle = { display: 'flex', alignItems: 'center', marginBottom: '0.4rem' };
const radioInputStyle = { marginRight: '0.6rem' };
const textareaStyle = { width: '100%', resize: 'vertical', padding: '0.5rem' };
const checkboxLabelStyle = { display: 'flex', alignItems: 'center', marginBottom: '0.4rem' };
const buttonContainerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' };
const buttonStyle = {
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#ef4444',
  color: '#fff',
};
