# Landing Page Images - Assets Folder

This folder should contain all images from the Figma design for the landing page.

## Required Images (Based on Figma Design):

1. **Main Section Images:**
   - Any background images or graphics for the "What Is Xigi?" section
   - Background gradient images for the data card section
   - Any decorative elements

2. **Data Card Images:**
   - Chart background images (if any)
   - Icon images for metrics
   - Any visual elements in the data card

3. **Additional Section Images:**
   - Hero section images (if applicable)
   - Feature section images
   - Any other section images from the design

## Image Naming Convention:
- Use descriptive names: `landing-hero-bg.png`, `landing-data-card-bg.png`, etc.
- Use lowercase with hyphens
- Use appropriate formats: `.png`, `.jpg`, `.webp`, `.svg`

## How to Add Images:
1. Export images from Figma design
2. Save them in this `/public/assets/` folder
3. Update the component to reference them using: `/assets/filename.png`

## Current Image Paths in Component:
- All images should be referenced from `/assets/` folder
- Example: `<img src="/assets/landing-hero.png" alt="Hero" />`
