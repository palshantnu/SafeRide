import React from "react";
import { Save, ArrowLeft, User, Mail, ShieldCheck, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserForm() {
  const navigate = useNavigate();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    color: '#1e293b',
    marginTop: '6px',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', animation: 'fadeSlideUp 0.4s ease' }}>
      
      {/* ── Header & Back Button ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button 
            onClick={() => navigate('/dashboard')} 
            style={{ 
              background: 'none', border: 'none', color: '#6366f1', 
              display: 'flex', alignItems: 'center', gap: '6px', 
              cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0, marginBottom: '8px'
            }}
          >
            <ArrowLeft size={14} /> Back to User List
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Add New User</h2>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>Fill in the details to register a new user in the system.</p>
        </div>
      </div>

      {/* ── Main Form Container ── */}
      <div style={{ 
        background: '#ffffff', borderRadius: '20px', 
        padding: '32px', border: '1.5px solid #eef2f7',
        boxShadow: '0 10px 25px rgba(0,0,0,0.02)'
      }}>
        
        <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Full Name */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}><User size={14} /> Full Name</label>
            <input 
              style={inputStyle} 
              placeholder="e.g. Rahul Sharma" 
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Email */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}><Mail size={14} /> Email Address</label>
            <input 
              style={inputStyle} 
              type="email" 
              placeholder="rahul@example.com" 
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* Role Selection */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}><ShieldCheck size={14} /> Assign Role</label>
            <select style={inputStyle}>
              <option value="customer">Customer</option>
              <option value="driver">Captain</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Status Selection */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}><Activity size={14} /> Account Status</label>
            <select style={inputStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          {/* Form Footer / Action Buttons */}
          <div style={{ 
            gridColumn: 'span 2', 
            marginTop: '12px', 
            paddingTop: '24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex', 
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button 
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b',
                padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
              }}
            >
              <Save size={16} /> Save User Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}