# Frozen Requirements Specification

> Verbatim text extraction from the authoritative PDF, with original line breaks retained. Page headings are navigation markers; the PDF remains authoritative if extraction differs from visual content.

## PDF page 1

```text
B2B Hyderabad V2 — Frozen Requirements Specification  
Frozen Requirements Set 01   |   Status: FROZEN 
This specification records the agreed frozen requirements for the new b2btravelv2 project. Each numbered 
set is appended after agreement and remains subject to change control. 
Frozen Requirements Set 01 
FR-01  Landing page and 8D Presence 
Status: FROZEN. The landing page shall communicate the application’s actual purpose through a clear 
blue-sky visual identity. “8D Presence” is the project’s design term for a cinematic spatial experience built 
with layered depth, parallax, perspective, atmospheric motion, and responsive interactions. Motion shall 
be choreographed to support comprehension and usability, remain performant on mobile devices, and 
respect reduced-motion preferences. The final tagline is TBD and is not frozen in this set. 
FR-02  Distinct landing actions and access 
Status: FROZEN. The landing page shall provide two distinct actions. “Join the Network” shall lead to 
registration and onboarding, followed by the authenticated dashboard. “Explore Businesses” shall lead to 
public business discovery without requiring login. When a visitor attempts a protected B2B action, the 
application shall require authentication before that action proceeds. 
FR-03  Persistent Market and Country Context 
Status: FROZEN. A user shall select a Market/Country Context before or at marketplace entry. The 
selected context shall persist during use and be shown in a visible switcher. It shall influence the 
businesses, services, packages, currency, and service availability presented to the user. The dashboard 
shall provide useful marketplace functionality beyond country selection. 
FR-04  Service verticals and business identity 
Status: FROZEN. The platform shall have three top-level service verticals: Tourism, Hajj & Umrah, and Visa 
Services. Business identity shall be modeled separately from service verticals so that one business can 
participate in multiple verticals. Currently supported business types are Travel Agency, Tour Operator, and 
Destination Management Company (DMC). Other business types will be defined in later requirement sets. 
Frozen Architecture Relationship 
Market → Service Vertical → Businesses → B2B Products/Services 
This relationship describes discovery and navigation. Business identity remains independent of service-
vertical membership, as specified in FR-04. 
Frozen Requirements Set 02 
Status: FROZEN. Users, business types, approval lifecycle, permissions, and access principles.
```

## PDF page 2

```text
FR-05  Super Admin 
Status: FROZEN. Super Admin is the highest application governance role. The authorization architecture 
shall reserve this role for platform ownership, administrator and role management, and platform-level 
control, even if its full interface is implemented later. 
FR-06  Admin authority 
Status: FROZEN. Admins shall review network applications; approve, reject, or request information; 
moderate marketplace content; and perform defined platform administration. Admins shall not 
impersonate businesses or carry out commercial actions on their behalf. 
FR-07  Business User and business types 
Status: FROZEN. Business User is one application role. Travel Agency, Tour Operator, and Destination 
Management Company (DMC) are business types, not authentication roles. 
FR-08  Guest discovery 
Status: FROZEN. Guests may explore permitted public marketplace information without registering. 
Protected B2B actions shall trigger the applicable registration, authentication, and approval checks. 
FR-09  Applicant state 
Status: FROZEN. Applicant is an account or business membership state, not a permanent application 
role. Applicants may access their application and status while awaiting a decision. 
FR-10  Business membership lifecycle 
Status: FROZEN. Business applications shall support Draft, Submitted, Under Review, Approved, Request 
Information, and Rejected states. A business that has been approved may subsequently be Suspended. 
Requested information may be supplied and the application resubmitted for review. 
FR-11  Authentication and authorization 
Status: FROZEN. Authentication establishes user identity; business approval establishes marketplace 
participation rights. Authentication alone shall not authorize protected B2B activity. 
FR-12  Protected business actions 
Status: FROZEN. Only an authenticated user acting for an approved business may perform protected B2B 
actions, including publishing marketplace offerings and platform messaging. 
FR-13  Business offerings 
Status: FROZEN. Approved businesses may create Packages, Services, and Offers. Their detailed 
definitions and data schemas are deferred to later requirement sets. 
FR-14  Business discovery and messaging 
Status: FROZEN. Approved businesses may discover other businesses and their public marketplace 
offerings and communicate with other businesses through platform messaging.
```

## PDF page 3

```text
FR-15  Separate geographic concepts 
Status: FROZEN. Business Location, Service or Destination Location, and Source or Target Market shall be 
represented separately. A business may be located in one country while offering a service in another and 
targeting a third market. 
FR-16  Application status notifications 
Status: FROZEN. Application status changes shall generate in-platform, email, and registered-mobile 
notifications. Delivery providers and technology will be decided later. 
FR-17  Engineering access 
Status: FROZEN. Tech Support and Developer access to the repository and engineering systems shall be 
managed separately from application roles and permissions. No web application role shall grant source-
code access. 
FR-18  Administrative auditability 
Status: FROZEN. Privileged administrative actions shall produce an auditable record. 
FR-19  Deferred detail 
Status: FROZEN. Detailed permission rules, registration fields, Package, Service and Offer schemas, and 
messaging rules shall be defined in subsequent requirement sets. 
Frozen Requirements Set 03 
Status: FROZEN. Availability-aware B2B marketplace, calendar discovery, geographic matching, and filter 
architecture. 
FR-20  Availability-aware discovery 
Status: FROZEN. The marketplace shall support discovery of relevant businesses, packages, and services 
using the business requirement: what is needed, where it is needed, when it is needed, for whom, and 
under which commercial conditions. Search shall account for availability rather than acting only as a static 
business directory. 
FR-21  Calendar and date filtering 
Status: FROZEN. Tourism and Hajj & Umrah discovery shall support calendar or date-based filtering for 
travel or service availability. Changing selected dates shall update relevant marketplace results. A visual 
calendar interface shall expose available, on-request, and unavailable states when the underlying supplier 
data supports them. 
FR-22  Vertical-specific search 
Status: FROZEN. The three service verticals shall use a shared filtering architecture with fields appropriate 
to each vertical. Tourism and Hajj & Umrah shall have travel or service date discovery, while Visa Services 
shall treat dates primarily as intended travel dates and processing requirements. Hajj & Umrah shall not be 
treated as Tourism with only a category checkbox.
```

## PDF page 4

```text
FR-23  Supplier availability data 
Status: FROZEN. Businesses creating packages or services shall be able to declare structured availability, 
including fixed dates, date ranges, recurring or year-round availability, and availability on request. The data 
architecture shall accommodate exceptions and capacity where relevant; the exact creation fields and 
initial release scope will be specified later. 
FR-24  Independent geographic matching 
Status: FROZEN. Marketplace matching shall distinguish business location, source or target market, 
departure or origin, and service or destination location. A provider may be shown for a relevant search 
regardless of where that provider is based, subject to the selected market and offering data. 
FR-25  Search context continuity 
Status: FROZEN. The marketplace shall preserve the selected market and search filters when a user opens 
a business or offering and returns to results. Business and offering pages may show how an item matches 
the active search context. 
FR-26  Progressive filtering interface 
Status: FROZEN. The primary search shall surface the most important fields for the selected vertical, with 
further filters available through an advanced or More Filters control. The interface shall not present every 
possible filter at once. 
FR-27  Visa result claims 
Status: FROZEN. Visa search and provider availability shall not imply guaranteed government or consular 
approval or guaranteed processing dates. 
FR-28  Deferred filter detail 
Status: FROZEN. Exact filter fields, product and availability schemas, result ranking, trust or reputation 
rules, and release phasing shall be defined in later requirement sets. This set freezes the discovery 
architecture and calendar concept rather than every advanced filter proposed during planning. 
Frozen Requirements Set 04 
Status: FROZEN. Platform foundation, authentication, security, availability, and scalability. 
FR-29  Concurrent capacity and load testing 
Status: FROZEN. The production platform shall support at least 500 concurrent active users under a 
defined production workload while maintaining acceptable response times and stability. Performance and 
load testing shall verify this capacity before production release. The architecture shall permit growth 
beyond this level without a fundamental application redesign. 
FR-30  Service availability objective 
Status: FROZEN. The production service shall target 99.9% monthly availability, excluding planned 
maintenance. Availability shall be measured and monitored.
```

## PDF page 5

```text
FR-31  Authentication lifecycle and login experience 
Status: FROZEN. The application shall provide registration, login, logout, password recovery and reset, 
verification where required, and session management. Email and password shall be the dependable 
baseline for Business User login. Login and recovery shall use clear validation, secure expiring recovery 
tokens, and responses that avoid disclosing whether an account exists. Additional mobile or OTP login may 
be specified later. 
FR-32  State-aware routing after login 
Status: FROZEN. After login, an applicant shall be directed to application status and any requested 
corrections; an approved Business User to the business dashboard; and an Admin to the administration 
interface. Suspended or rejected states shall receive appropriate access and status messaging rather than 
unrestricted business controls. 
FR-33  Secure sessions 
Status: FROZEN. Authentication shall use a secure server-managed session lifecycle. Sessions shall 
expire and support revocation; logout shall invalidate the relevant session. Session security shall include 
secure cookie settings and CSRF protection where applicable. Account suspension or a security event 
shall be able to revoke access. 
FR-34  Multi-factor authentication 
Status: FROZEN. Multi-factor authentication shall be mandatory for Admin and Super Admin accounts. It 
may initially be optional for Business Users, while the architecture shall allow stronger requirements later. 
FR-35  Backend authorization 
Status: FROZEN. Every protected backend operation shall enforce the applicable role, business approval 
state, ownership or record-level access, and action permission. Frontend visibility of controls shall not be 
treated as authorization. 
FR-36  Transactional data and search 
Status: FROZEN. PostgreSQL shall be the primary transactional database. The data layer shall support 
migrations, referential integrity, appropriate indexes, pagination, transactions for critical multi-step 
operations, and connection pooling. Marketplace filtering and availability search shall use indexed server-
side queries and pagination rather than downloading all records for client-side filtering. 
FR-37  Secure file handling 
Status: FROZEN. Uploaded assets and private documents shall be stored in suitable object storage with 
database references. Uploads shall be subject to type and size validation; private files shall require 
authorization and shall not be publicly enumerable. Additional controls such as malware scanning and 
time-limited access shall be applied where appropriate. 
FR-38  API and secret security 
Status: FROZEN. Backend APIs shall validate input and business rules, enforce authentication and 
authorization, and protect against common injection and browser attacks. The platform shall use 
appropriate request-size limits, HTTP security settings, and cross-origin controls. Secrets and sensitive 
configuration shall remain outside frontend bundles.
```

## PDF page 6

```text
FR-39  Rate limiting and abuse protection 
Status: FROZEN. Authentication, password recovery, messaging, uploads, and public marketplace 
endpoints shall have operation-appropriate rate limits and abuse protection. Exact thresholds shall be set 
during implementation and performance testing. 
FR-40  Audit records 
Status: FROZEN. Important administrative and security actions shall create audit records identifying the 
actor, action, resource, time, and outcome. Ordinary users shall not be able to alter audit records. 
FR-41  Observability and health checks 
Status: FROZEN. Production shall provide application and error logs, performance and database 
monitoring, job or queue monitoring, and security-event visibility. Operational health checks shall report 
the state of the API and critical dependencies sufficiently for monitoring and deployment decisions. 
FR-42  Backups and recovery 
Status: FROZEN. The platform shall have automated database backups, defined retention, a documented 
restore process, periodic restore testing, and deployment rollback capability. Production migrations shall 
consider recovery. Exact recovery objectives shall be defined later. 
FR-43  Environment separation 
Status: FROZEN. Development, staging, and production shall use separated configuration and data. 
Staging shall permit end-to-end validation of core workflows before production deployment; development 
and testing shall not operate on the production database. 
FR-44  Modular and horizontally scalable backend 
Status: FROZEN. The backend shall use a modular-monolith architecture with clear capability boundaries. 
Application instances shall be stateless where practical so the API can scale horizontally without rewriting 
business logic. Supporting cache or queue infrastructure shall be introduced where justified. 
FR-45  Failure isolation and graceful degradation 
Status: FROZEN. Failure of messaging, email, mobile notifications, or another non-core supporting 
capability shall not prevent unrelated marketplace or business-management operations wherever 
technically feasible. Failed asynchronous work shall be recorded, monitored, and retried where 
appropriate; failures shall remain visible to operators. 
FR-46  MVP business account model 
Status: FROZEN. MVP shall support one primary approved Business Owner account per Business. User 
and Business shall remain separate entities so future releases can support multiple staff accounts for one 
Business without redesigning the core business data model. Staff invitations, staff roles, and team 
management are deferred. 
Frozen Requirements Set 05 
Status: FROZEN. Hajj & Umrah MVP functional requirements.
```

## PDF page 7

```text
F01  Business Registration and Verification 
FR-47  Registration information 
Status: FROZEN. A multi-step network application shall capture the owner identity; legal and trading 
business names; business type; registered address and country, state, and city; email and mobile 
contacts; optional website; years in operation; Hajj & Umrah capabilities; source markets; Saudi service 
destinations; registration or licence information; and supporting documents. 
FR-48  Registration flow 
Status: FROZEN. Applicants shall be able to save and continue an application, see progress and step 
validation, upload documents, preview the completed application, and submit it. Email and mobile contact 
verification shall be completed before final submission. 
FR-49  Document requirements 
Status: FROZEN. The application shall support business registration or licence documents and other 
supporting material. Which documents are required shall be configurable by market and business type 
rather than permanently hard-coded. 
FR-50  Review and correction 
Status: FROZEN. Admin shall be able to view the application summary, full details, documents, 
verification status, internal notes, and review history, then approve, request information, or reject. The 
applicant shall be able to correct requested information and resubmit. 
FR-51  Approval versus external accreditation 
Status: FROZEN. B2B Hyderabad approval shall mean only that the platform approved the business for its 
network. Relevant Saudi authorization, provider, external-agent, or licence information may be recorded 
separately, but platform approval shall never be presented as government accreditation. 
F02  Business Profile and Trust 
FR-52  Authoritative business profile 
Status: FROZEN. Each approved business shall have one authoritative profile with its logo, name, type, 
description, headquarters, contact channels, years operating, languages, markets served, Hajj & Umrah 
capabilities, service locations, approval status, and marketplace offerings. 
FR-53  Profile geography and trust 
Status: FROZEN. A profile shall distinguish business location, source markets, service countries, and 
service cities. “B2B Hyderabad Approved Business” shall identify platform approval only; any external 
licence or accreditation shall show its separate issuer or source. 
FR-54  Contact visibility 
Status: FROZEN. Public visitors shall be able to view a business marketplace profile with limited sensitive 
contact information. Approved businesses shall receive the richer B2B contact and messaging capabilities 
allowed by their permissions.
```

## PDF page 8

```text
F03  Packages Services Offers and Availability 
FR-55  Distinct commercial objects 
Status: FROZEN. The MVP shall model Package, Service, and Offer as distinct objects. A Package is a 
bundled travel product; a Service is an individual capability; an Offer is a promotional or commercial 
proposition associated with a Package or Service where appropriate. 
FR-56  Hajj and Umrah subtypes 
Status: FROZEN. Hajj and Umrah shall be distinct subtypes within the shared Hajj & Umrah vertical. 
Shared infrastructure may be reused, while subtype-specific fields and rules shall remain possible, 
including future Hajj-specific operational details. 
FR-57  Umrah package details 
Status: FROZEN. An Umrah package shall capture supplier, name, source market and departure city, 
destination cities, travel or validity dates, total and Makkah/Madinah nights, traveller or group applicability, 
accommodation and room occupancy, transport, flights when applicable, meals, visa inclusion or status, 
ziyarat, guide or assistance, inclusions and exclusions, B2B pricing and currency, availability, cancellation 
terms, and relevant images or documents. 
FR-58  Offering lifecycle 
Status: FROZEN. Packages shall support Draft, Published, Paused, and Archived states. The owner shall 
be able to preview, edit, duplicate, and archive an offering. Draft deletion may be allowed; published 
historical records should be archived rather than destructively deleted. 
FR-59  Availability and capacity 
Status: FROZEN. Package and Service availability shall support fixed departures, date ranges, recurrence, 
year-round operation, and on-request availability, with blackout dates where relevant. Explicit capacity or 
group-size values shall be optional; suppliers may instead use on-request availability. 
FR-60  B2B pricing 
Status: FROZEN. Offerings shall support fixed B2B price, starting-from price, and price on request. A 
currency shall be required whenever a price is displayed. 
FR-61  Geographic separation 
Status: FROZEN. Every offering shall distinguish the supplier location, source market or departure point, 
and service destination rather than assuming these are the same place. 
FR-62  Custom package request 
Status: FROZEN. An approved business shall be able to request a custom Hajj or Umrah package from a 
selected provider, supplying dates, departure city, group size, nights, and service requirements. The 
request shall retain its supplier and requirement context for follow-up. 
F04  Marketplace Dashboard and Navigation 
FR-63  Focused business navigation 
Status: FROZEN. The authenticated MVP shall provide Home, Hajj & Umrah Marketplace, Businesses, My 
Packages & Services, Messages, Notifications, and My Business as its primary business areas. The current 
market selector shall remain globally accessible.
```

## PDF page 9

```text
FR-64  Operational dashboard 
Status: FROZEN. The business dashboard shall prioritize marketplace search, current market, active 
Packages and Services, messages needing attention, application or account notices, recent marketplace 
activity, and quick creation of a Package or Service. 
FR-65  Requirement-oriented search and results 
Status: FROZEN. The Hajj & Umrah marketplace search shall use departure or source market, travel dates, 
traveller or group size, and Hajj or Umrah subtype. Results shall support Packages, Services, and 
Businesses views under the same preserved search context. 
FR-66  Specialized filters 
Status: FROZEN. Hajj & Umrah results shall offer relevant filters for dates, departure or source market, 
Saudi destination or city, trip nights and Makkah/Madinah nights, accommodation and room occupancy, 
group size, package type, visa inclusion, transport, meals, price and currency, availability, supplier type, 
and platform approval status. 
FR-67  Package comparison 
Status: FROZEN. Approved businesses shall be able to shortlist and compare a small number of Hajj or 
Umrah Packages on core fields including dates, nights, accommodation, transport, visa inclusion, meals, 
and B2B price. 
F05  B2B Messaging and Enquiries 
FR-68  Messaging eligibility and context 
Status: FROZEN. Only authenticated users acting for approved businesses may initiate or respond to B2B 
marketplace conversations. A conversation may begin from a Business, Package, Service, Offer, or Custom 
Package Request and shall retain that context. 
FR-69  Messaging functions 
Status: FROZEN. The MVP shall support text messages, timestamps, unread state, basic document or 
image attachments, a conversation list and search, and a contextual reference to the relevant business or 
offering. 
FR-70  Enquiry actions and abuse controls 
Status: FROZEN. Relevant marketplace items shall expose Message Supplier and, where appropriate, 
Enquire or Request Custom Package actions. Messaging shall have rate limits and block or report controls. 
FR-71  Messaging isolation 
Status: FROZEN. Messaging or notification failures shall not block marketplace discovery, Package 
management, Business Profile management, or other unrelated core operations. 
F06  Administration 
FR-72  Admin workspace 
Status: FROZEN. The Admin Console shall provide Dashboard, Applications, Businesses, Marketplace, 
Users, Reports, Audit, and System Health areas. Its dashboard shall surface pending and information-
requested applications, approved and suspended businesses, published inventory, reports or flags, and 
operational alerts.
```

## PDF page 10

```text
FR-73  Application and business administration 
Status: FROZEN. Admin shall review applicant details, business information, documents, verification, 
history, and internal notes; approve, request information, or reject applications; and inspect business 
approval history, account status, listings, and relevant moderation or security history. Authorized 
suspension and reactivation shall be supported. 
FR-74  Marketplace moderation and accountability 
Status: FROZEN. Admin shall be able to inspect Packages, Services, and Offers, hide or suspend 
problematic listings, and record a moderation reason. Admin shall not impersonate a supplier or perform 
commercial actions as that supplier. 
FR-75  System health view 
Status: FROZEN. Admin shall have a safe high-level view of API, database, background job, notification, 
and messaging health. Sensitive engineering or infrastructure details shall remain outside ordinary Admin 
access. 
MVP Product Boundary 
Status: FROZEN. B2B Hyderabad is a specialized B2B marketplace and business collaboration platform. It 
shall not represent itself as Nusuk, a Saudi governmental authorization platform, or a substitute for official 
Saudi Hajj, Umrah, or visa systems. 
Change Control 
Status: FROZEN. Requirements in Sets 01, 02, 03, 04, and 05 shall not be silently altered. Any change 
requires explicit agreement and a recorded revision. Subsequent frozen requirement sets shall be 
appended as separately numbered sections.
```

