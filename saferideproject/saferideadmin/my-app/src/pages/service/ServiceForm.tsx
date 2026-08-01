import React from "react";
import { Save, ArrowLeft, Type, DollarSign, Clock, Layout, AlignLeft, Image as ImageIcon,Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ServiceForm() {
  const navigate = useNavigate();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid #e2e8f0',
    borderRadius: '10px', color: '#1e293b', marginTop: '6px', fontSize: '13px', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '32px', border: '1.5px solid #eef2f7', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Configure Service</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>Add new service category and pricing details.</p>

        <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Title */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}><Type size={14} /> Service Title</label>
            <input style={inputStyle} name="title" placeholder="e.g. Premium Sedan Delivery" />
          </div>

          {/* Image & Banner */}
          <div>
            <label style={labelStyle}><ImageIcon size={14} /> Service Image URL</label>
            <input style={inputStyle} name="image" placeholder="https://path-to-image.png" />
          </div>
          <div>
            <label style={labelStyle}><Layout size={14} /> Banner Text</label>
            <input style={inputStyle} name="banner" placeholder="Short banner highlight" />
          </div>

          {/* Description */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}><AlignLeft size={14} /> Service Description</label>
            <textarea style={{ ...inputStyle, height: '80px', resize: 'none' }} name="description" placeholder="Describe the service benefits..." />
          </div>

          {/* Price & Currency */}
          <div>
            <label style={labelStyle}><DollarSign size={14} /> Price</label>
            <input style={inputStyle} name="price" placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}><Hash size={14} /> Currency Code</label>
            <select style={inputStyle} name="currency_code">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          {/* Time & Position */}
          <div>
            <label style={labelStyle}><Clock size={14} /> Estimated Time</label>
            <input style={inputStyle} name="time" placeholder="e.g. 30-45 mins" />
          </div>
          <div>
            <label style={labelStyle}><Hash size={14} /> Display Position</label>
            <input style={inputStyle} type="number" name="position" placeholder="Order (e.g. 1)" />
          </div>

          {/* Status */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="status" value="1" defaultChecked /> Active
              </label>
              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="status" value="0" /> Deactive
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ gridColumn: 'span 2', marginTop: '12px', display: 'flex', gap: '12px' }}>
            <button type="submit" style={{ flex: 1, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={18} /> Save Service
            </button>
            <button type="button" onClick={() => navigate(-1)} style={{ flex: 1, background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}