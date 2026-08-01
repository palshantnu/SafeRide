import React, { useState } from "react";
import { 
  Save, ArrowLeft, User, Phone, Lock, Briefcase, 
  Car, FileText, Calendar, Hash, CheckCircle, Info,
  Activity, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DriverForm() {
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
  };

  const fileInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    background: '#f8fafc',
    border: '1.5px dashed #cbd5e1',
    borderRadius: '10px',
    marginTop: '6px',
    fontSize: '12px',
    cursor: 'pointer'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const sectionHeader = (title: string) => (
    <div style={{ 
      gridColumn: 'span 2', paddingBottom: '8px', marginBottom: '8px',
      borderBottom: '1px solid #f1f5f9', color: '#475569', 
      fontSize: '14px', fontWeight: 700, marginTop: '16px'
    }}>
      {title}
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/Driverlist')} 
          style={{ background: 'none', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0, marginBottom: '8px' }}
        >
          <ArrowLeft size={14} /> Back to Captains
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Register New Captain</h2>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '20px', padding: '32px', border: '1.5px solid #eef2f7', boxShadow: '0 10px 25px rgba(0,0,0,0.02)' }}>
        
        <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Section 1: Basic Information */}
          {sectionHeader("Basic & Account Information")}
          <div>
            <label style={labelStyle}><User size={14} /> Full Name</label>
            <input style={inputStyle} name="full_name" placeholder="Captain's Full Name" />
          </div>
          <div>
            <label style={labelStyle}><Phone size={14} /> Phone Number</label>
            <input style={inputStyle} name="phone" placeholder="+91 00000-00000" />
          </div>
          <div>
            <label style={labelStyle}><Lock size={14} /> Password</label>
            <input style={inputStyle} type="password" name="password" placeholder="Set login password" />
          </div>
          <div>
            <label style={labelStyle}><Briefcase size={14} /> Service Type</label>
            <select style={inputStyle} name="service_id">
              <option value="">Select Service</option>
              <option value="1">Taxi Service</option>
              <option value="2">Delivery Service</option>
            </select>
          </div>

          {/* Section 2: Vehicle Details */}
          {sectionHeader("Vehicle Details")}
          <div>
            <label style={labelStyle}><Car size={14} /> Vehicle Number</label>
            <input style={inputStyle} name="vehicle_number" placeholder="MP 07 AA 0000" />
          </div>
          <div>
            <label style={labelStyle}><Info size={14} /> Vehicle Model</label>
            <input style={inputStyle} name="vehicle_model" placeholder="Swift / Dzire" />
          </div>
          <div>
            <label style={labelStyle}><Hash size={14} /> Seat Capacity</label>
            <input style={inputStyle} type="number" name="seat_capacity" defaultValue="4" />
          </div>
          <div>
            <label style={labelStyle}><Activity size={14} /> Fuel Type</label>
            <select style={inputStyle} name="fuel_type">
              <option value="Petrol">Petrol</option>
              <option value="CNG">CNG</option>
              <option value="Diesel">Diesel</option>
            </select>
          </div>

          {/* Section 3: Documents & Uploads */}
          {sectionHeader("Document Verification")}
          <div>
            <label style={labelStyle}><FileText size={14} /> Document Type</label>
            <select style={inputStyle} name="document_type">
              <option value="aadhar">Aadhar Card</option>
              <option value="dl">Driving License</option>
              <option value="rc">Registration Certificate (RC)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}><Hash size={14} /> Document Number</label>
            <input style={inputStyle} name="document_number" placeholder="Enter ID number" />
          </div>

          {/* --- Document File Upload --- */}
          <div style={{ gridColumn: 'span 1' }}>
            <label style={labelStyle}><Upload size={14} /> Upload Document (Image/PDF)</label>
            <input 
              type="file" 
              name="document_file" 
              style={fileInputStyle}
              accept="image/*,.pdf" 
            />
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Max size: 2MB (JPG, PNG, PDF)</p>
          </div>

          <div>
            <label style={labelStyle}><Calendar size={14} /> Expiry Date</label>
            <input style={inputStyle} type="date" name="expiry_date" />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}><CheckCircle size={14} /> Registration Status</label>
            <select style={inputStyle} name="status">
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Submit Button */}
          <div style={{ 
            gridColumn: 'span 2', marginTop: '20px', paddingTop: '24px',
            borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' 
          }}>
            <button 
              type="button" 
              onClick={() => navigate('/dashboard/drivers')}
              style={{ background: 'white', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white', border: 'none', padding: '10px 32px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', 
                fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
              }}
            >
              <Save size={16} /> Complete Registration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}