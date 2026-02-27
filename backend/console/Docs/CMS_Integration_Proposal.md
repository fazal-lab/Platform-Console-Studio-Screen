# 📄 Proposal: CMS-Agnostic Integration Architecture for Xigi Platform

## 1. Background & Problem Statement

Xigi Platform integrates with partner LED screens to deliver and manage ad campaigns.
Currently, different partners use **different CMS software** such as:

* VNNOX (Novastar)
* Colorlight CMS
* Linsn CMS
* Other proprietary or manual CMS systems

Each CMS has:

* Different APIs
* Different capabilities
* Different integration limitations

### Problem:

If Xigi integrates **directly with one CMS**, the platform will:

* Become tightly coupled to that CMS
* Face rework for every new partner
* Scale poorly as partner count increases

---

## 2. Objective

To design a **single, scalable integration system** that:

* Supports **multiple CMS vendors**
* Avoids rewriting core logic for each partner
* Allows onboarding new CMS platforms with minimal effort
* Keeps Xigi as the **central system of control**

---

## 3. Proposed Solution: CMS Adapter Architecture

We propose building a **CMS-Agnostic Integration Layer** using an **Adapter Pattern**.

### High-level idea:

* Xigi defines its **own standard CMS operations**
* Each CMS gets its own **adapter**
* Adapters translate Xigi requests into CMS-specific APIs

---

## 4. Architecture Overview

### Logical Flow:

```
Xigi Core Platform
   ↓
Common CMS Interface (Xigi Standard)
   ↓
CMS Adapter Layer
   ↓
Partner CMS (VNNOX / Others)
   ↓
LED Screens
```

### Key Principle:

> Xigi never directly depends on any one CMS vendor.

---

## 5. Common CMS Interface (Xigi Standard)

Xigi will define a **fixed set of CMS operations**, such as:

* Upload creative (image/video)
* Create playlist / program
* Assign screens
* Schedule or publish content
* Fetch screen status
* Monitor playback status

These operations represent **business intent**, not vendor-specific implementation.

---

## 6. CMS Adapters (Vendor-Specific)

Each CMS adapter will:

* Implement the same standard interface
* Internally call that CMS's APIs
* Handle authentication, formatting, and constraints

### Example:

| CMS        | Adapter                         |
| ---------- | ------------------------------- |
| VNNOX      | VNNOX Adapter                   |
| Colorlight | Colorlight Adapter              |
| Linsn      | Linsn Adapter                   |
| Manual CMS | Manual / Semi-Automated Adapter |

This ensures **plug-and-play extensibility**.

---

## 7. First Phase Implementation: VNNOX Adapter

### Why VNNOX first:

* Widely used by LED partners
* Mature CMS with API support
* Suitable as a reference implementation

### Scope of VNNOX Adapter:

* Authentication & token handling
* Media upload
* Program / playlist creation
* Screen assignment
* Publish & basic monitoring

Once stable, this adapter will serve as the **baseline** for future CMS adapters.

---

## 8. Handling CMS Capability Differences

Not all CMS platforms offer the same features.

Strategy:

* Define **minimum supported capabilities**
* Adapter returns `Not Supported` for unavailable features
* Xigi UI adapts based on partner CMS capability

This ensures:

* Graceful degradation
* No platform breakage
* Clear expectations with partners

---

## 9. Benefits of This Approach

### Technical Benefits:

* Loose coupling
* Cleaner architecture
* Easier maintenance
* Faster onboarding of new CMS vendors

### Business Benefits:

* Partner flexibility
* Faster expansion
* Reduced integration cost
* Future-proof platform

---

## 10. Risks & Mitigation

| Risk                 | Mitigation                       |
| -------------------- | -------------------------------- |
| CMS APIs unavailable | Manual / hybrid adapter          |
| API limitations      | Capability-based feature flags   |
| Overengineering      | Phase-wise rollout (VNNOX first) |

---

## 11. Phased Rollout Plan

1. Define common CMS interface
2. Build VNNOX adapter
3. Validate with live partners
4. Stabilize interface
5. Add new CMS adapters as needed

---

## 12. Conclusion

This approach allows Xigi to act as a **single unified platform**, regardless of the CMS technologies used by partners.
Starting with VNNOX ensures fast execution while laying a scalable foundation for the future.

---

## 💬 One-line Executive Summary

> "We'll integrate with multiple CMS platforms using a single standardized interface and CMS-specific adapters, starting with a VNNOX adapter as the first implementation."
