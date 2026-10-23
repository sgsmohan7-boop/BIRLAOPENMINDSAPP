# Management Portal — Simplified Executive Admission Data Register & View

This update redesigns the Admission Data view in the Management Portal so that school managers, principals, and directors can see, filter, and monitor all student admissions with clarity and zero clutter. It introduces an Executive Admissions Register table with instant status filters, counsellor/grade filtering, search, export to CSV, and quick inspection of parent meeting notes and audio recordings.

## User Review & Critical Decisions

> [!IMPORTANT]
> Please review the proposed architecture and click **Proceed** to start building.

- **Decision 1 — Clean Executive Table View as Primary**: The Admission Data section will feature a clean, high-density table displaying S.No, Enquiry No, Student Name, Applying Grade, Parent Name & Contact, Assigned Counsellor, Admission Status, Follow-up Date, and Audio Status.
- **Decision 2 — Dual-Mode Display**: Managers can easily toggle between the **Simple Table Register** (row-by-row candidate view) and the **Grade-Wise Pipeline Grid** (class-by-class capacity cards) with a single click.
- **Decision 3 — Instant Management Controls**: Includes one-click CSV export, quick status filter pills (All, Confirmed, Applications In-Review, Follow-ups), search bar, and instant view/print modal shortcuts.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a dedicated, easy-to-read admissions dashboard for school management that displays real-time admissions data in a clean tabular register, removing guesswork and unnecessary clicks.
- **Target Audience**: School Managing Director, Principal, Academic Dean, and Admissions Audit Leads.
- **Key Value**: Delivers instant visibility into every admission candidate, fee discussion status, parent contact, and conversion progress across all grades.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Quick Register Inspection**:
     - The manager navigates to **Admissions Data** in the Management Portal.
     - At the top, 4 executive metric boxes display: Total Enquiries, Confirmed Admissions, Applications Taken, and Follow-up Pipeline.
     - Below, a clean search and filter bar allows filtering by status (`All`, `Confirmed`, `Applications Taken`, `Follow-up Required`), counsellor, and grade.
     - The table lists all students with clear typography, tabular numbers, status pills, and clickable row details.
  2. **View Candidate Details & Physical Slip**:
     - Clicking any candidate opens a quick slide-out or modal showing full contact info, points discussed, audio translation summary, and a button to print the official admission form.
  3. **Export to CSV**:
     - 1-click **Export CSV** button downloads the filtered admissions list formatted for Excel and executive reporting.
- **Visual Identity & Theme**:
  - *Palette*: Crisp enterprise slate (`#0F172A` / `#FFFFFF`) with emerald accents for confirmed admissions, amber for in-review applications, and indigo for counsellors.
  - *Typography*: `Plus Jakarta Sans` for clean titles, paired with `tabular-nums` for serial numbers, enquiry IDs, and dates.
  - *Density*: Compact 40px table row height with hover highlights and zero nested card sandwiches.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: In-Place Table Register vs Multi-Level Submenus**
  - *Chosen Approach*: Embed the clean Admissions Table Register directly inside the Admissions tab with a toggle for the 18-grade pipeline.
  - *Why*: Gives managers instant access to student rows without having to click into 18 separate grade folders.
- **Decision 2: Seamless Synchronization with Counselling Records**
  - *Chosen Approach*: Reactively bind the register to `safeEnquiries` so any new enquiry or status update from counsellors appears live in the manager's view.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Component & State Architecture**:
```
┌──────────────────────────────────────────────────────────────────────────┐
│                           MANAGEMENT PORTAL                              │
│   (State: activeTab = "admissions", enquiries, counsellorAccounts)       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   EXECUTIVE ADMISSION DATA VIEW                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Executive Metric Strip: Total | Confirmed | In Review | Follow  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Control Toolbar: Search | Status Filter | Counsellor | Export   │  │
│  │    [ Table View (Default) ]  [ Grade Pipeline Matrix (18 Classes) ]│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 3. Simplified Executive Admissions Table:                          │  │
│  │    # | Enquiry No | Student | Grade | Parent & Phone | Counsellor  │  │
│  │    Status Badge | Next Follow-up | Audio Recorded | Action Buttons │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 4. Quick Candidate Detail & Print Modal                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Implementation Details**:
  - Update `src/components/ManagementPortal.tsx` inside the `activeTab === "admissions"` block.
  - Add search filter, status filter, counsellor filter, grade section filter, and pagination.
  - Implement CSV export function for the filtered admissions list.
  - Add quick action buttons: **View Form**, **Print Slip**, and **Open Audio Review**.
