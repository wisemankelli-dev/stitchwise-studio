import React, { useState, useRef } from 'react';
import {
  Flower2, Sparkles, Scissors, Grid3X3,
  Heart, Send, CheckCircle2,
  UploadCloud, Mail, User,
  Ruler, Image, Plus, Trash2, ArrowLeft, AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FloralDivider, DecorativeFlower } from '../components/DecorativeSVGs';

interface CustomRequestForm {
  crafterName: string;
  email: string;
  patternSize: 'small' | 'medium' | 'large' | 'custom';
  customWidth: number;
  customHeight: number;
  designType: 'embroidery' | 'quilt-block' | 'collage';
  description: string;
  colors: string[];
  customColorHex: string;
  referenceImages: File[];
}

interface FormErrors {
  crafterName?: string;
  email?: string;
  patternSize?: string;
  designType?: string;
  description?: string;
  colors?: string;
}

const PRESET_COLORS = [
  { name: 'Rose Red', hex: '#e11d48' },
  { name: 'Blush Pink', hex: '#f472b6' },
  { name: 'Soft Peach', hex: '#fb7185' },
  { name: 'Sunset Gold', hex: '#d97706' },
  { name: 'Warm Cream', hex: '#fef3c7' },
  { name: 'Forest Green', hex: '#16a34a' },
  { name: 'Ocean Blue', hex: '#0284c7' },
  { name: 'Royal Violet', hex: '#7c3aed' },
  { name: 'Pitch Black', hex: '#1e293b' },
  { name: 'Snow White', hex: '#f8fafc' },
];

const SIZE_OPTIONS = [
  { id: 'small' as const, label: 'Small', desc: '4×4″ (32×32 grid)' },
  { id: 'medium' as const, label: 'Medium', desc: '6×6″ (48×48 grid)' },
  { id: 'large' as const, label: 'Large', desc: '8×8″ (64×64 grid)' },
  { id: 'custom' as const, label: 'Custom', desc: 'Enter dimensions' },
];

const DESIGN_TYPES = [
  { id: 'embroidery' as const, label: 'Embroidery Pattern', icon: Sparkles },
  { id: 'quilt-block' as const, label: 'Quilt Block Design', icon: Grid3X3 },
  { id: 'collage' as const, label: 'Collage Quilting', icon: (props: any) => <Scissors className="rotate-[-45deg]" {...props} /> },
];

export const SubmitProject: React.FC = () => {
  const [formData, setFormData] = useState<CustomRequestForm>({
    crafterName: '',
    email: '',
    patternSize: 'small',
    customWidth: 10,
    customHeight: 10,
    designType: 'embroidery',
    description: '',
    colors: ['#f472b6'],
    customColorHex: '#e11d48',
    referenceImages: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.crafterName.trim() || formData.crafterName.trim().length < 2)
      newErrors.crafterName = 'Name must be at least 2 characters';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Please enter a valid email address';
    if (!formData.patternSize) newErrors.patternSize = 'Please select a pattern size';
    if (!formData.designType) newErrors.designType = 'Please select a design type';
    if (!formData.description.trim() || formData.description.trim().length < 20)
      newErrors.description = 'Description must be at least 20 characters';
    if (formData.colors.length === 0) newErrors.colors = 'Please select at least one color';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitted(true);
  };

  const toggleColor = (hex: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.includes(hex)
        ? prev.colors.filter(c => c !== hex)
        : [...prev.colors, hex],
    }));
  };

  const addCustomColor = () => {
    if (!formData.customColorHex) return;
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.includes(prev.customColorHex) ? prev.colors : [...prev.colors, prev.customColorHex],
      customColorHex: '#e11d48',
    }));
    setShowColorPicker(false);
  };

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 3);
    setFormData(prev => ({
      ...prev,
      referenceImages: [...prev.referenceImages, ...newFiles].slice(0, 3),
    }));
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      referenceImages: prev.referenceImages.filter((_, i) => i !== index),
    }));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(false); handleFilesAdded(e.dataTransfer.files); };

  if (isSubmitted) {
    const sizeLabel = SIZE_OPTIONS.find(s => s.id === formData.patternSize)?.label || formData.patternSize;
    const typeLabel = DESIGN_TYPES.find(d => d.id === formData.designType)?.label || formData.designType;
    return (
      <div className="min-h-screen bg-gradient-to-b from-blush-50 via-white to-blush-50 py-16 px-6 relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]">
          <svg className="w-full h-full"><defs><pattern id="success-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="12" fill="#f472b6" /><circle cx="80" cy="80" r="16" fill="#f472b6" />
          </pattern></defs><rect width="100%" height="100%" fill="url(#success-floral)" /></svg>
        </div>
        <div className="max-w-lg mx-auto relative z-10">
          <FloralDivider />
          <div className="bg-white rounded-3xl shadow-2xl shadow-blush-100/60 p-10 text-center border border-blush-100 mt-8">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 rounded-full bg-blush-50 flex items-center justify-center">
                <Heart className="h-10 w-10 text-blush-500 fill-blush-300" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Pattern Request Received!</h2>
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 rounded-full px-4 py-1.5 border border-emerald-100 mb-6">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700">Submitted successfully</span>
            </div>
            <p className="text-slate-600 text-sm mb-2">Thank you, <span className="font-bold text-blush-700">{formData.crafterName}</span>!</p>
            <p className="text-slate-500 text-sm mb-6">
              We've received your request for a <strong className="text-slate-700">{sizeLabel}</strong>{' '}
              <strong className="text-slate-700">{typeLabel}</strong> using{' '}
              <strong className="text-slate-700">{formData.colors.length} colors</strong>.
            </p>
            <div className="bg-blush-50 rounded-2xl p-5 border border-blush-100 mb-8 text-left text-sm text-slate-600 space-y-1">
              <p>✉️ We'll contact you at <strong className="text-blush-700">{formData.email}</strong></p>
              <p>⏱️ Our design team will review your specs within 24 hours</p>
              <p>📎 You'll receive a custom pattern draft for your review</p>
            </div>
            <button onClick={() => setIsSubmitted(false)}
              className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blush-200/50 hover:from-blush-600 hover:to-blush-500 hover:shadow-xl hover:shadow-blush-300/50 transition-all duration-200 flex items-center justify-center gap-2">
              <Flower2 className="h-4 w-4" /> Request Another Pattern
            </button>
          </div>
          <FloralDivider />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blush-50 via-white to-blush-50 py-12 px-6 lg:px-8 relative overflow-hidden">
      {/* Floral watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]">
        <svg className="w-full h-full"><defs><pattern id="custom-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="12" fill="#f472b6" /><circle cx="30" cy="30" r="6" fill="#f9a8d4" />
          <circle cx="80" cy="80" r="16" fill="#f472b6" /><circle cx="80" cy="80" r="8" fill="#f9a8d4" />
          <circle cx="130" cy="30" r="12" fill="#f472b6" />
        </pattern></defs><rect width="100%" height="100%" fill="url(#custom-floral)" /></svg>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blush-600 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <FloralDivider />

        {/* Page Header */}
        <div className="text-center mb-10 mt-6">
          <div className="flex justify-center mb-4">
            <DecorativeFlower size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-400">Custom</span>{' '}
            <span className="text-slate-800">Pattern Request</span>
          </h1>
          <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
            🪡 Every crafter&apos;s dream starts with a vision — share yours and we&apos;ll bring it to life, stitch by stitch.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* SIDEBAR */}
          <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            {/* How it works */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/40 border border-blush-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blush-500" /> How It Works
              </h3>
              <div className="space-y-5">
                {[
                  { num: '①', title: 'Tell Us Your Vision', desc: 'Size, colors, and pattern details' },
                  { num: '②', title: "We'll Design It", desc: 'Expert digitizers craft your perfect pattern' },
                  { num: '③', title: 'You Receive & Stitch', desc: 'Download-ready in 24 hours' },
                ].map((step) => (
                  <div key={step.num} className="flex gap-3">
                    <span className="text-lg shrink-0">{step.num}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{step.title}</p>
                      <p className="text-[10px] text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-gradient-to-br from-blush-50 to-white rounded-2xl p-5 shadow-lg shadow-blush-100/40 border border-blush-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span> Pro Tip
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                &ldquo;Include fabric type and machine model for best results!&rdquo;
              </p>
            </div>

            {/* What we support */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/40 border border-blush-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Scissors className="h-4 w-4 text-blush-500" /> What We Support
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {['.PES, .DST, .EXP file formats', 'Brother, Singer, Janome machines', 'Aida 11–18 count, linen', 'DMC thread color mapping'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-blush-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* FORM PANEL */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl shadow-blush-100/50 p-8 sm:p-10 border border-blush-100 space-y-7">
              {/* Pattern Size */}
              <fieldset>
                <legend className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <Ruler className="h-4 w-4 text-blush-500" /> Pattern Size <span className="text-blush-500">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {SIZE_OPTIONS.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => setFormData(prev => ({ ...prev, patternSize: opt.id }))}
                      className={`px-4 py-3 rounded-xl text-sm font-semibold border text-left transition-all ${
                        formData.patternSize === opt.id
                          ? 'bg-blush-500 border-blush-500 text-white shadow-sm'
                          : 'bg-white border-blush-100 text-slate-700 hover:bg-blush-50'
                      }`}>
                      <div className="font-bold">{opt.label}</div>
                      <div className={`text-[10px] font-normal ${formData.patternSize === opt.id ? 'text-white/80' : 'text-slate-400'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                {formData.patternSize === 'custom' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Width (inches)</label>
                      <input type="number" min={1} max={48} value={formData.customWidth}
                        onChange={(e) => setFormData(prev => ({ ...prev, customWidth: Number(e.target.value) }))}
                        className="w-full rounded-lg border-blush-100 text-sm px-3 py-2 mt-1 focus:border-blush-500 focus:ring-blush-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Height (inches)</label>
                      <input type="number" min={1} max={48} value={formData.customHeight}
                        onChange={(e) => setFormData(prev => ({ ...prev, customHeight: Number(e.target.value) }))}
                        className="w-full rounded-lg border-blush-100 text-sm px-3 py-2 mt-1 focus:border-blush-500 focus:ring-blush-500" />
                    </div>
                  </div>
                )}
                {errors.patternSize && <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.patternSize}</p>}
              </fieldset>

              {/* Design Type */}
              <fieldset>
                <legend className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  🧵 Design Type <span className="text-blush-500">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {DESIGN_TYPES.map((dt) => {
                    const Icon = dt.icon;
                    return (
                      <button key={dt.id} type="button" onClick={() => setFormData(prev => ({ ...prev, designType: dt.id }))}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-semibold border transition-all ${
                          formData.designType === dt.id
                            ? 'bg-blush-500 border-blush-500 text-white shadow-sm'
                            : 'bg-white border-blush-100 text-slate-600 hover:bg-blush-50'
                        }`}>
                        <Icon className={`h-5 w-5 ${formData.designType === dt.id ? '' : 'text-blush-400'}`} />
                        <span>{dt.label}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.designType && <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.designType}</p>}
              </fieldset>

              {/* Colors */}
              <fieldset>
                <legend className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  🎨 Colors <span className="text-blush-500">*</span>
                </legend>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button key={c.hex} type="button" onClick={() => toggleColor(c.hex)} title={c.name}
                      className="h-8 w-8 rounded-full border transition-all relative flex items-center justify-center"
                      style={{ backgroundColor: c.hex, borderColor: formData.colors.includes(c.hex) ? '#f472b6' : 'rgba(0,0,0,0.1)' }}>
                      {formData.colors.includes(c.hex) && <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowColorPicker(!showColorPicker)}
                    className="h-8 w-8 rounded-full border-2 border-dashed border-blush-300 bg-blush-50 hover:bg-blush-100 flex items-center justify-center transition-all">
                    <Plus className="h-4 w-4 text-blush-500" />
                  </button>
                </div>
                {showColorPicker && (
                  <div className="flex items-center gap-2 p-3 bg-blush-50 rounded-xl border border-blush-100 mb-3">
                    <input type="color" value={formData.customColorHex}
                      onChange={(e) => setFormData(prev => ({ ...prev, customColorHex: e.target.value }))}
                      className="h-8 w-8 rounded cursor-pointer border border-blush-200" />
                    <span className="text-[10px] font-mono text-slate-600">{formData.customColorHex}</span>
                    <button type="button" onClick={addCustomColor}
                      className="rounded-lg bg-blush-500 text-white text-[10px] font-bold px-3 py-1.5 hover:bg-blush-600 transition-all">
                      Add
                    </button>
                  </div>
                )}
                {errors.colors && <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.colors}</p>}
              </fieldset>

              {/* Description */}
              <fieldset>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  📝 Pattern Description <span className="text-blush-500">*</span>
                </label>
                <textarea rows={5} value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your dream pattern in detail... What's the main subject? Any specific elements or motifs? Fabric type and weave?"
                  className="w-full rounded-xl border-blush-100 text-sm text-slate-800 shadow-sm focus:border-blush-500 focus:ring-blush-500 placeholder:text-blush-300 resize-none" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">{formData.description.length} / 1000 (min 20)</span>
                  {errors.description && <span className="text-[10px] text-rose-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.description}</span>}
                </div>
              </fieldset>

              {/* Reference Images */}
              <fieldset>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  🖼️ Reference Images <span className="text-[10px] text-slate-400 font-normal">(Optional, max 3)</span>
                </label>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple
                  onChange={(e) => handleFilesAdded(e.target.files)} />
                {formData.referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {formData.referenceImages.map((file, idx) => (
                      <div key={idx} className="relative h-20 w-20 rounded-xl overflow-hidden border border-blush-100 group">
                        <img src={URL.createObjectURL(file)} alt={`ref-${idx}`} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {formData.referenceImages.length < 3 && (
                  <div onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDraggingOver ? 'border-blush-500 bg-blush-50/50' : 'border-blush-200 hover:bg-blush-50/50'
                    }`}>
                    <UploadCloud className="h-8 w-8 mx-auto text-blush-400 mb-1" />
                    <p className="text-xs font-bold text-slate-600">Drop files here or click to browse</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG — max 3 images</p>
                  </div>
                )}
              </fieldset>

              {/* Crafter Name */}
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blush-500" /> Crafter Name <span className="text-blush-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blush-300" />
                  <input type="text" value={formData.crafterName}
                    onChange={(e) => setFormData(prev => ({ ...prev, crafterName: e.target.value }))}
                    placeholder="Your name"
                    className="w-full rounded-xl border-blush-100 text-sm text-slate-800 pl-10 pr-4 py-2.5 focus:border-blush-500 focus:ring-blush-500" />
                </div>
                {errors.crafterName && <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.crafterName}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-blush-500" /> Email Address <span className="text-blush-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blush-300" />
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border-blush-100 text-sm text-slate-800 pl-10 pr-4 py-2.5 focus:border-blush-500 focus:ring-blush-500" />
                </div>
                {errors.email && <p className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{errors.email}</p>}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blush-200/50 hover:from-blush-600 hover:to-blush-500 hover:shadow-xl hover:shadow-blush-300/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2">
                  <Heart className="h-4 w-4 fill-white/30" /> Submit Pattern Request
                </button>
              </div>
            </form>
          </div>
        </div>

        <FloralDivider />
      </div>
    </div>
  );
};