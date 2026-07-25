# BA Registration - Add Pincode Field

## Steps:

### 1. Database Migration
- [x] Add `pincode VARCHAR(20)` column to `business_associates` table

### 2. Backend - businessAssociate.js (ACTIVE controller)
- [x] Update `verifyAndRegisterBA` to accept `pincode` from req.body
- [x] Include `pincode` in INSERT query for new BA
- [x] Include `pincode` in the response data

### 3. Frontend - SignupScreen.js
- [x] Add pincode TextInput field in BA registration form (PIN Code input with map-pin icon, 6-digit numeric)
- [x] Add pincode validation (required + 6-digit) in validateBusinessFields()
- [x] Pass pincode in businessData payload (`pincode: pinCode`) to VERIFY_BA_OTP

### 4. Frontend - action-creator.js
- [x] Update `VERIFY_BA_OTP` to include `pincode` in the payload (already destructures `...data` from payload)

