import { useState } from 'react'
import Step1_Identifiers from '../steps/Step1_Identifiers'
import Step2_Display from '../steps/Step2_Display'
import Step3_Visibility from '../steps/Step3_Visibility'
import Step4_Playback from '../steps/Step4_Playback'
import Step5_Commercials from '../steps/Step5_Commercials'
import Step6_Compliance from '../steps/Step6_Compliance'
import Step7_Summary from '../steps/Step7_Summary'
import './styles/ScreenSpecPack.css'

/**
 * Screen Spec Pack Feature Entry Point
 * 
 * Usage:
 * import ScreenSpecPack from './features/ScreenSpecPack'
 * <ScreenSpecPack />
 */
function ScreenSpecPack() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({})

  // Get the logged-in user's name for admin_name
  const adminName = (() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.username || user.name || localStorage.getItem('username') || ''
  })()

  const STEPS = [
    { id: 1, name: 'Identifiers', component: Step1_Identifiers },
    { id: 2, name: 'Display', component: Step2_Display },
    { id: 3, name: 'Visibility', component: Step3_Visibility },
    { id: 4, name: 'Playback', component: Step4_Playback },
    { id: 5, name: 'Commercials', component: Step5_Commercials },
    { id: 6, name: 'Compliance', component: Step6_Compliance },
    { id: 7, name: 'Summary', component: Step7_Summary },
  ]

  const CurrentStepComponent = STEPS[currentStep - 1].component

  const validateStep = (step) => {
    if (step === 1) {
      if (!formData.screen_name?.trim()) return "Screen Name is required."
      if (!formData.city?.trim()) return "City is required."
      if (!formData.latitude || !formData.longitude) return "Location is required. Please verify on map."
      if (!formData.full_address?.trim()) return "Full Address is required."
      if (!formData.nearest_landmark?.trim()) return "Nearest Landmark is required."
      if (!formData.nearest_landmark?.trim()) return "Nearest Landmark is required."
    }

    if (step === 2) {
      if (!formData.technology) return "Technology is required."
      if (!formData.environment) return "Environment is required."
      if (!formData.screen_type) return "Screen Type is required."
      if (!formData.screen_width) return "Screen Width is required."
      if (!formData.screen_height) return "Screen Height is required."
      if (!formData.resolution_width || !formData.resolution_height) return "Resolution is required."
      if (!formData.pixel_pitch_mm) return "Pixel Pitch is required."
      if (!formData.brightness_nits) return "Brightness is required."
      if (!formData.refresh_rate_hz) return "Refresh Rate is required."
    }

    if (step === 3) {
      // Visibility
      if (!formData.installation_type?.trim()) return "Installation Type is required."
      if (!formData.mounting_height_ft) return "Mounting Height is required."
      if (!formData.facing_direction?.trim()) return "Facing Direction is required."
      if (!formData.road_type?.trim()) return "Road Type is required."
      if (!formData.traffic_direction?.trim()) return "Traffic Direction is required."
      if (!formData.viewing_angle?.trim()) return "Viewing Angle is required."
      if (!formData.min_viewing_distance_meters?.trim()) return "Viewing Distance is required."
    }

    if (step === 4) {
      // Playback & Connectivity
      if (!formData.standard_ad_duration_sec) return "Standard Ad Duration is required."
      if (!formData.total_slots_per_loop) return "Total Slots is required."
      // reserved_slots can be 0, so check undefined/null/empty string
      if (formData.reserved_slots === undefined || formData.reserved_slots === '') return "Reserved Slots is required (enter 0 if none)."

      if (!formData.supported_formats_json || formData.supported_formats_json.length === 0) return "Select at least one supported format."
      if (!formData.max_file_size_mb) return "Max File Size is required."

      if (!formData.internet_type) return "Internet Type is required."
      if (!formData.average_bandwidth_mbps) return "Bandwidth is required."
      if (!formData.power_backup_type) return "Power Backup selection is required."

      if (!formData.days_active_per_week) return "Days Active is required."
      if (!formData.downtime_windows) return "Downtime Windows is required (enter 'None' if applicable)."
    }

    if (step === 5) {
      // Commercials - Core required fields
      if (!formData.base_price_per_slot_inr) return "Base Price is required."
      if (!formData.sensitive_zone_flags_json || formData.sensitive_zone_flags_json.length === 0) return "Sensitive zone flags is required."
      if (!formData.restricted_categories_json || formData.restricted_categories_json.length === 0) return "Categories restricted is required."

      // Conditional: Seasonal pricing - must add at least one complete season
      if (formData.seasonal_pricing) {
        const seasons = formData.seasons_json || []
        if (seasons.length === 0) return "Add at least one season for seasonal pricing."
        // Check if at least one season is complete
        const hasCompleteSeason = seasons.some(s => s.name && s.type && s.percentage)
        if (!hasCompleteSeason) return "Complete all fields for at least one season (Name, Type, %)."
      }

      // Conditional: Minimum booking
      if (formData.enable_min_booking && !formData.minimum_booking_days) {
        return "Set minimum booking days or uncheck the option."
      }
    }

    if (step === 6) {
      // Compliance - Proof & Monitoring
      if (!formData.cms_type) return "CMS type is required."
      // Documents & GST
      if (!formData.ownership_proof_uploaded) return "Ownership Proof document is required."
      if (!formData.permission_noc_available) return "Municipality NOC document is required."
      if (!formData.partner_gst) return "Partner GST is required."
      if (!formData.content_policy_accepted) return "You must accept the Content Policy."
    }

    return null
  }

  const handleNext = () => {
    const error = validateStep(currentStep)
    if (error) {
      alert(error)
      return
    }
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1)
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }))
  }

  const handleSave = () => {
    console.log('Saving Draft:', formData)
    alert('Draft Saved!')
  }

  const handleSubmit = async () => {
    console.log('Submitting Form:', formData)

    try {
      // Use FormData for file upload support
      const submitData = new FormData()

      // Add admin_name
      if (adminName) submitData.append('admin_name', adminName)

      // Add all form fields to FormData
      Object.keys(formData).forEach(key => {
        const value = formData[key]

        if (value === null || value === undefined) {
          // Skip null/undefined values
          return
        } else if (value instanceof File) {
          // File objects - add directly
          submitData.append(key, value)
        } else if (Array.isArray(value) || typeof value === 'object') {
          // Arrays and objects - stringify as JSON
          submitData.append(key, JSON.stringify(value))
        } else {
          // Primitives (strings, numbers, booleans)
          submitData.append(key, value)
        }
      })

      const response = await fetch('http://192.168.31.226:8000/api/partner/screen-specs/', {
        method: 'POST',
        // Don't set Content-Type header - browser will set it with boundary for multipart
        body: submitData
      });

      if (response.ok) {
        const result = await response.json();
        alert('Success! Screen ID: ' + result.id);
        // Reset form or redirect
      } else {
        const errorData = await response.json();

        // Format the error message to be readable
        let errorMsg = errorData.message || 'Validation failed. Please check the submitted data.\n\n';

        if (errorData.errors) {
          Object.entries(errorData.errors).forEach(([field, messages]) => {
            errorMsg += `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}\n`;
          });
        }

        alert(errorMsg);
      }
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Network Error: Could not connect to backend.');
    }
  }

  const handleTabClick = (stepId) => {
    // Allow going back freely
    if (stepId < currentStep) {
      setCurrentStep(stepId)
      return
    }

    // Prevent jumping ahead more than 1 step
    if (stepId > currentStep + 1) {
      return // specific logic or just ignore
    }

    // Validate current step before proceeding
    const error = validateStep(currentStep)
    if (error) {
      alert(error)
      return
    }

    setCurrentStep(stepId)
  }

  // Calculate validity of current step for UI state
  const isCurrentStepValid = !validateStep(currentStep)

  return (
    <div className="ssp-container">
      <div className="ssp-form-card">
        {/* Progress Bar */}
        <div className="ssp-progress">
          {STEPS.map(step => {
            // Logic: Can go back. Can go to Next only if Current is Valid. Future steps locked.
            const isLocked = step.id > currentStep + 1 || (step.id === currentStep + 1 && !isCurrentStepValid)

            return (
              <div
                key={step.id}
                className={`ssp-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={() => !isLocked && handleTabClick(step.id)}
              >
                {step.id}. {step.name}
              </div>
            )
          })}
        </div>

        {/* Current Step Component */}
        {currentStep === 7 ? (
          <Step7_Summary
            data={formData}
            adminName={adminName}
            onGoBack={() => setCurrentStep(6)}
            onConfirmSubmit={handleSubmit}
          />
        ) : (
          <CurrentStepComponent
            data={formData}
            update={updateFormData}
          />
        )}

        {/* Actions Footer - Hidden on Summary page */}
        {currentStep !== 7 && (
          <div className="ssp-actions">
            <button className="ssp-btn ssp-btn-secondary" onClick={handleSave}>
              Save Draft
            </button>
            <button
              className="ssp-btn ssp-btn-primary"
              onClick={handleNext}
              disabled={!isCurrentStepValid}
              title={!isCurrentStepValid ? "Please fill all required fields" : ""}
            >
              {currentStep === 6 ? 'Review & Submit' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ScreenSpecPack
