# PAIDI SOC2 TYPE II & ENTERPRISE SECURITY WHITEPAPER

**Document Version:** 4.2-Production  
**Compliance Standard:** SOC2 Type II, ISO/IEC 27001, FIPS 140-3 Level 3  
**Classification:** Confidential Enterprise Whitepaper  

## Section 1: Cryptographic Enclave Architecture
PAIDI utilizes Intel SGX and AMD SEV hardware-isolated enclaves for all vector retrieval and embedding operations. 
1. **At-Rest Encryption:** All vector embeddings and stored document chunks are encrypted using AES-256-GCM authenticated encryption.
2. **In-Transit Protection:** Client connections enforce TLS 1.3 with forward secrecy (ECDHE-RSA-AES256-GCM-SHA384).
3. **Enclave Attestation:** Every worker node undergoes cryptographic remote attestation prior to receiving tenant query context. Plaintext data never resides outside encrypted volatile memory.

## Section 2: Key Management & Automated Rotation
1. **Key Hierarchy:** A Master Key Encryption Key (KEK) is stored in a hardware security module (HSM). Data Encryption Keys (DEKs) are generated per-tenant.
2. **Rotation Schedule:** Tenant DEKs undergo automated cyclic rotation every **seventy-two (72) hours**. In the event of an anomalous access pattern, a force keycycle can be triggered within sub-300 milliseconds.

## Section 3: Data Loss Prevention & Zero-Leakage Guarantee
PAIDI guarantees strict hermetic multi-tenant isolation. No cross-tenant vector contamination is mathematically possible. Queries and responses are bound to tenant cryptographic IDs and validated by hardware-enforced memory encryption.
