# Onboarding Refinements & Bug Fixes

- [x] Step 3: Indoor Logic Refinements
    - [x] Disable "Road Type" and "Traffic Direction" if "Environment" is "Indoor".
    - [x] Reset these fields to null in state/DB when "Indoor" is selected.
- [x] Step 4: Downtime Windows Enhancements
    - [x] Add "Enable Downtime" checkbox.
    - [x] Validation: Downtime mandatory if checkbox checked.
    - [x] Validation: Start and End times cannot be identical.
- [x] Step 5: Commercials Enhancements
    - [x] Seasonal Pricing: Require at least one row if enabled.
- [x] Global Dropdown Improvements
    - [x] Every dropdown now has literally "Select..." as the first option.
- [x] Bug Fix: Submission Button
    - [x] Fixed "Review & Submit" disabled state in Step 7.
- [x] Verification & Terminology
    - [x] Rename "Verified" status to "Approved" globally in UI.
    - [x] Standardize status filters (e.g., adding "All" option).
    - [x] Test the entire onboarding flow with new validations.
