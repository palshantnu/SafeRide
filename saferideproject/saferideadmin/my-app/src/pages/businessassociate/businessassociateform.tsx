import React, { useState } from "react";
import { Save, ArrowLeft, UserCheck, Hash, Briefcase, Percent, ShieldCheck, CreditCard, FileText, UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── KYC Document keys ──────────────────────────────────────────────────────────
type KycDocKey = 'aadhar_front' | 'aadhar_back' | 'pancard';
interface KycDoc { file: File | null; preview: string | null; }

export default function BAForm() {
  const navigate = useNavigate();

  // ─── KYC state ────────────────────────────────────────────────────────────────
  const [kyc, setKyc] = useState<Record<KycDocKey, KycDoc>>({
    aadhar_front: { file: null, preview: null },
    aadhar_back:  { file: null, preview: null },
    pancard:      { file: null, preview: null },
  });
  const [gstNumber, setGstNumber] = useState('');

  const handleKycFile = (key: KycDocKey, file: File | null) => {
    if (!file) return;
    setKyc(prev => {
      if (prev[key].preview?.startsWith('blob:')) URL.revokeObjectURL(prev[key].preview!);
      return { ...prev, [key]: { file, preview: URL.createObjectURL(file) } };
    });
  };

  const clearKycFile = (key: KycDocKey) => {
    setKyc(prev => {
      if (prev[key].preview?.startsWith('blob:')) URL.revokeObjectURL(prev[key].preview!);
      return { ...prev, [key]: { file: null, preview: null } };
    });
  };

  // Consistent Input Styles
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    background: '#f8fafc', // Light grey background for inputs
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    color: '#1e293b',
    marginTop: '8px',
    fontSize: '15px', // Standard readable font size
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  // Improved Label Styles
  const labelStyle: React.CSSProperties = {
    fontSize: '13px', // Slightly larger for better readability
    fontWeight: 600,
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const containerStyle: React.CSSProperties = {
    padding: '40px 24px',
    maxWidth: '850px',
    margin: '0 auto',
    minHeight: '100vh'
  };

  return (
    <div style={containerStyle}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none', border: 'none', color: '#6366f1',
          display: 'flex', alignItems: 'center', gap: '6px',
          cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          marginBottom: '24px', padding: '4px 0'
        }}
      >
        <ArrowLeft size={18} /> Back to List
      </button>

      {/* Main Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '28px',
        padding: '48px',
        border: '1px solid #eef2f7',
        boxShadow: '0 20px 40px rgba(0,0,0,0.04)'
      }}>

        {/* Header Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Business Associate Profile
          </h2>
          <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px' }}>
            Configure partnership details and commission structures.
          </p>
        </div>

        <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

          {/* Associate Name - Full Width */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}><UserCheck size={16} color="#6366f1" /> Associate Full Name</label>
            <input style={inputStyle} name="ba_name" placeholder="Enter business or associate name" />
          </div>

          {/* BA Code */}
          <div>
            <label style={labelStyle}><Hash size={16} color="#6366f1" /> Unique BA Code</label>
            <input style={inputStyle} name="ba_code" placeholder="e.g. BA-GWL-2026" />
          </div>

          {/* Service ID */}
          <div>
            <label style={labelStyle}><Briefcase size={16} color="#6366f1" /> Service Category ID</label>
            <input style={inputStyle} type="number" name="service_id" placeholder="Select ID" />
          </div>

          {/* Commission Rate - Full Width with Info */}
          <div style={{ gridColumn: 'span 2', background: '#f1f5f980', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <label style={labelStyle}><Percent size={16} color="#6366f1" /> Settlement Commission Rate (%)</label>
            <input
              style={{ ...inputStyle, background: '#ffffff' }}
              type="number"
              step="0.01"
              name="commission_rate"
              placeholder="0.00"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#94a3b8', marginTop: '6px' }} />
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                This rate determines the automatic deduction from each successful transaction handled by this associate.
              </p>
            </div>
          </div>

          {/* ─── KYC Documents Section ─── */}
          <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '28px', borderRadius: '20px', border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#6366f1" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>KYC Documents</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Upload Aadhar (front &amp; back), PAN card and GST number</p>
              </div>
            </div>

            {/* Document upload tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '22px' }}>
              {([
                { key: 'aadhar_front', label: 'Aadhar Front', icon: <CreditCard size={18} color="#6366f1" /> },
                { key: 'aadhar_back',  label: 'Aadhar Back',  icon: <CreditCard size={18} color="#6366f1" /> },
                { key: 'pancard',      label: 'PAN Card',     icon: <FileText size={18} color="#6366f1" /> },
              ] as { key: KycDocKey; label: string; icon: React.ReactNode }[]).map(doc => {
                const current = kyc[doc.key];
                return (
                  <div key={doc.key}>
                    <label style={{ ...labelStyle, marginBottom: '8px' }}>{doc.icon} {doc.label}</label>
                    <div
                      onClick={() => (document.getElementById(`kyc-${doc.key}`) as HTMLInputElement | null)?.click()}
                      style={{
                        position: 'relative',
                        border: `2px dashed ${current.preview ? '#c7d2fe' : '#e2e8f0'}`,
                        borderRadius: '14px', height: '128px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', background: '#ffffff', overflow: 'hidden', textAlign: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {current.preview ? (
                        <>
                          <img src={current.preview} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); clearKycFile(doc.key); }}
                            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(15,23,42,0.7)', border: 'none', borderRadius: 8, padding: 4, cursor: 'pointer', display: 'flex' }}
                          >
                            <X size={13} color="white" />
                          </button>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={26} color="#94a3b8" />
                          <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', fontWeight: 600 }}>Click to upload</span>
                          <span style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>JPG, PNG or PDF</span>
                        </>
                      )}
                      <input
                        id={`kyc-${doc.key}`}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={e => handleKycFile(doc.key, e.target.files?.[0] ?? null)}
                        style={{ display: 'none' }}
                      />
                    </div>
                    {current.file && (
                      <p style={{ fontSize: '11px', color: '#16a34a', margin: '6px 2px 0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ✓ {current.file.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* GST Number */}
            <div style={{ marginTop: '22px' }}>
              <label style={labelStyle}><Hash size={16} color="#6366f1" /> GST Number</label>
              <input
                style={{ ...inputStyle, background: '#ffffff', textTransform: 'uppercase' }}
                name="gst_number"
                value={gstNumber}
                onChange={e => setGstNumber(e.target.value.toUpperCase())}
                maxLength={15}
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 2px 0' }}>
                15-character GSTIN as printed on the registration certificate.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            gridColumn: 'span 2',
            marginTop: '16px',
            display: 'flex',
            gap: '16px',
            paddingTop: '32px',
            borderTop: '1.5px solid #f1f5f9'
          }}>
            <button
              type="submit"
              style={{
                flex: 2,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white', border: 'none', padding: '16px',
                borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '10px',
                boxShadow: '0 10px 20px rgba(79, 70, 229, 0.2)'
              }}
            >
              <Save size={20} /> Register Associate
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                flex: 1,
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                color: '#475569', padding: '16px',
                borderRadius: '14px', fontSize: '15px',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
