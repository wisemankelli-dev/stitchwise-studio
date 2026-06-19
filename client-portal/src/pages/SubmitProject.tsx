import React, { useState } from 'react';
import { Send, CheckCircle, Sparkles, Building2, Mail, User, Scissors } from 'lucide-react';

/**
 * SubmitProject page enabling serial crafters to submit custom pattern specs.
 */
export const SubmitProject: React.FC = () => {
  const [formData, setFormData] = useState({
    founderName: '',
    email: '',
    companyName: '',
    projectName: '',
    description: '',
    budget: 'mid',
    servicesNeeded: [] as string[],
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleServiceChange = (service: string) => {
    if (formData.servicesNeeded.includes(service)) {
      setFormData({
        ...formData,
        servicesNeeded: formData.servicesNeeded.filter((s) => s !== service),
      });
    } else {
      setFormData({
        ...formData,
        servicesNeeded: [...formData.servicesNeeded, service],
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.founderName.trim()) newErrors.founderName = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.projectName.trim()) newErrors.projectName = 'Design name is required';
    if (!formData.description.trim()) {
      newErrors.description = 'Please tell us some details about your custom design';
    } else if (formData.description.trim().length < 20) {
      newErrors.description = 'Description should be at least 20 characters';
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitted(true);
    console.log('Crafting spec submitted successfully:', formData);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Request Custom Pattern Spec</h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Can't find the perfect pattern? Let the StitchWise Studio design team bring your crafting dreams to life. Provide details below and receive a custom digitized stitch-ready file.
          </p>
        </div>

        {isSubmitted ? (
          <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-sm border border-slate-100 text-center max-w-2xl mx-auto">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-6">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Request Spec Received!</h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              Thank you, <span className="font-semibold text-slate-800">{formData.founderName}</span>. We've received your spec for <span className="font-semibold text-slate-800">{formData.projectName}</span>. Our embroidery master digitizers will analyze your request and reach out at <span className="font-semibold text-slate-800">{formData.email}</span> within 24 hours with a custom pattern draft!
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  founderName: '',
                  email: '',
                  companyName: '',
                  projectName: '',
                  description: '',
                  budget: 'mid',
                  servicesNeeded: [],
                });
              }}
              className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
            >
              Request Another Pattern
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-sm border border-slate-100 grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Sidebar info */}
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  What happens next?
                </h3>
                <ul className="mt-4 space-y-4 text-sm text-slate-600">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">1</span>
                    <span><strong>Spec Analysis:</strong> We evaluate design dimensions, stitch types, and hoop alignment constraints.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">2</span>
                    <span><strong>Thread Boxing:</strong> We custom map your colors to major thread sets (DMC, Anchor, Madeira).</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">3</span>
                    <span><strong>Digitized Export:</strong> We generate and test the files, then deliver a secure link to download .PES or .DST formats.</span>
                  </li>
                </ul>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                  <Scissors className="h-5 w-5 text-brand-600 -rotate-45" />
                  Fabric & Machine Info
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We support patterns designed for standard fabrics (Aida count 11-18, linen, heavy canvas) and optimized for Brother, Singer, Janome, and Bernina sewing machines.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="founderName" className="block text-sm font-semibold text-slate-700">Crafter Name *</label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="founderName"
                      value={formData.founderName}
                      onChange={(e) => setFormData({ ...formData, founderName: e.target.value })}
                      className={`block w-full rounded-md border-0 py-2.5 pl-10 text-slate-900 ring-1 ring-inset ${errors.founderName ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                      placeholder="Jane Doe"
                    />
                  </div>
                  {errors.founderName && <p className="mt-1.5 text-xs text-red-600">{errors.founderName}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700">Email Address *</label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`block w-full rounded-md border-0 py-2.5 pl-10 text-slate-900 ring-1 ring-inset ${errors.email ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                      placeholder="jane@crafter.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700">Shop / Company Name</label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="block w-full rounded-md border-0 py-2.5 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 placeholder:text-slate-400 sm:text-sm sm:leading-6"
                      placeholder="Handmade Studio"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="projectName" className="block text-sm font-semibold text-slate-700">Design Name *</label>
                  <input
                    type="text"
                    id="projectName"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className={`mt-1 block w-full rounded-md border-0 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ${errors.projectName ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                    placeholder="Floral Cabin Scene"
                  />
                  {errors.projectName && <p className="mt-1.5 text-xs text-red-600">{errors.projectName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Services Needed</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'digitize', label: 'Digitize Image to Stitches' },
                    { id: 'custom', label: 'Bespoke Pattern Layout' },
                    { id: 'marketplace', label: 'Marketplace Setup Help' },
                  ].map((service) => (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => handleServiceChange(service.id)}
                      className={`px-4 py-3 rounded-lg border text-sm font-semibold text-left transition-colors ${formData.servicesNeeded.includes(service.id) ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
                    >
                      {service.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-slate-700">Pattern Description & Design Specs *</label>
                <textarea
                  id="description"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`mt-1 block w-full rounded-md border-0 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ${errors.description ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
                  placeholder="Outline your target dimensions, fabric weave details, stitch densities, thread color code preferences (e.g. DMC series), and specific embroidery machine compatibility..."
                />
                {errors.description && <p className="mt-1.5 text-xs text-red-600">{errors.description}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Pattern Complexity</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'low', label: 'Hobbyist Pattern' },
                    { value: 'mid', label: 'Detailed Motif' },
                    { value: 'high', label: 'Masterpiece Collection' },
                  ].map((tier) => (
                    <label
                      key={tier.value}
                      className={`flex items-center justify-center px-4 py-3 rounded-lg border text-sm font-semibold cursor-pointer transition-colors ${formData.budget === tier.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
                    >
                      <input
                        type="radio"
                        name="budget"
                        value={tier.value}
                        checked={formData.budget === tier.value}
                        onChange={() => setFormData({ ...formData, budget: tier.value })}
                        className="sr-only"
                      />
                      {tier.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 flex items-center justify-center gap-2 transition-all duration-200"
                >
                  <Send className="h-5 w-5" />
                  Submit Pattern Specification
                </button>
              </div>
            </form>

          </div>
        )}
      </div>
    </div>
  );
};
