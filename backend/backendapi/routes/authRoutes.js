// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const service = require('../controllers/serviceController');
const driver = require('../controllers/driverController');
const baController = require("../controllers/businessAssociate");
const bookingController = require("../controllers/bookingController");
const UserController = require("../controllers/UserapiController");
const pagesController = require("../controllers/pagesController");
const landingController = require("../controllers/landingController");
const popupController = require("../controllers/popupController");
const appBannerController = require("../controllers/appBannerController");
const contactController = require("../controllers/contactController");
const notificationController = require("../controllers/notificationController");
const adminNotificationController = require("../controllers/adminNotificationController");
const ratingController = require("../controllers/ratingController");
const staffController = require("../controllers/adminStaffController");
const authMiddleware = require('../middleware/authMiddleware');
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");
const meterimage = require("../middleware/meter_image");
const uploadDriver = require('../middleware/uploadDriverProfile');
const uploadService = require('../middleware/uploadservice');
const uploadSubservice = require('../middleware/uploadsubservice');
const uploaduserprofile = require('../middleware/uploaduserprofile');
const uploadplan = require('../middleware/uploadplan');
const uploadBAProfile = require('../middleware/uploadBAProfile');
const uploadLanding = require('../middleware/uploadLanding');
const uploadPopup = require('../middleware/uploadPopup');
const uploadAppBanner = require('../middleware/uploadAppBanner');
const uploadNotification = require('../middleware/uploadNotification');
const selfSharingController = require('../controllers/selfSharingController');
const parcelController = require('../controllers/parcelController');
const uploadParcel = require('../middleware/uploadParcel');
const onspotController = require('../controllers/onspotController');
const locationController = require('../controllers/locationController');
const chatController = require('../controllers/chatController');

//---------------------------------------------------Admin-panel---------------------------------------------------------------//

// ── Current admin (permissions for the logged-in user) ─────────────────────//
router.get('/admin/me',                        verifyToken, staffController.getMe);
router.put('/admin/profile',                   verifyToken, staffController.updateAdminProfile);

// ── Staff ──────────────────────────────────────────────────────────────────//
router.post('/admin/staff',                    staffController.createStaff);
router.get('/admin/staff',                     staffController.getStaffList);
router.get('/admin/staff/:id',                 staffController.getStaffById);
router.put('/admin/staff/:id',                 staffController.updateStaff);
router.delete('/admin/staff/:id',              staffController.deleteStaff);
router.put('/admin/staff/:id/assign-role',     staffController.assignRoleToStaff);

// ── Roles ──────────────────────────────────────────────────────────────────//
router.post('/admin/roles',                    staffController.createRole);
router.get('/admin/roles',                     staffController.getRoles);
router.put('/admin/roles/:id',                 staffController.updateRole);
router.delete('/admin/roles/:id',              staffController.deleteRole);
router.post('/admin/roles/:id/permissions',    staffController.assignPermissionsToRole);
router.get('/admin/roles/:id/permissions',     staffController.getRolePermissions);

// ── Permissions ────────────────────────────────────────────────────────────//
router.post('/admin/permissions',              staffController.createPermission);
router.post('/admin/permissions/seed',         staffController.seedPermissions);
router.get('/admin/permissions',               staffController.getPermissions);
router.get('/admin/permission-matrix',         staffController.getPermissionMatrix);
router.get('/admin/permission-matrix/:role_id',staffController.getPermissionMatrix);
router.delete('/admin/permissions/:id',        staffController.deletePermission);

// ── States & Cities (admin manage) ─────────────────────────────────────────//
router.post('/admin/states',                   locationController.createState);
router.get('/admin/states',                    locationController.adminGetStates);
router.put('/admin/states/:id',                locationController.updateState);
router.delete('/admin/states/:id',             locationController.deleteState);
router.post('/admin/cities',                   locationController.createCity);
router.get('/admin/cities',                    locationController.adminGetCities);
router.put('/admin/cities/:id',                locationController.updateCity);
router.delete('/admin/cities/:id',             locationController.deleteCity);

router.post('/register', auth.register);
router.post('/login', auth.login);
router.put('/user/:id', auth.updateUser);
router.get('/users', authMiddleware, auth.getUsers);
router.get('/userlist', UserController.userList);
router.get('/driverlist', driver.driverList);
router.delete('/drivers/:id', driver.deleteDriver);
router.get('/drivers/:id/bookings', driver.getDriverBookingsByAdmin);
router.get('/drivers/:id/documents', driver.getDriverDocumentsByAdmin);
router.patch('/drivers/:id/documents/:doc_id/verify', driver.verifyDriverDocument);
router.get('/drivers/:id', driver.getDriverById);
router.put('/drivers/:id', driver.updateDriver);
router.post('/drivers',     driver.createDriver);

//-----------------------------------------------------Users Api---------------------------------------------------------------//

router.post('/user/send-otp', auth.sendOTP);
router.post('/user/verify-otp', auth.verifyOTP);
router.get('/states', locationController.getStates);
router.get('/cities', locationController.getAllCities);
router.get('/states/:state_id/cities', locationController.getCities);
router.post('/user/bookingrequest', verifyToken,bookingController.createBookingRequest);
router.post('/user/getplan', verifyToken,bookingController.getPlans);
router.post('/user/paytokenamount', verifyToken,UserController.payToken);
router.post('/user/payremainingBalance', verifyToken,UserController.payBalance);
router.post('/user/payTopup', verifyToken, UserController.payTopup);
router.get('/user/bookinghistory', verifyToken, UserController.userBookingHistory);
router.get('/user/userCurrentBooking', verifyToken, UserController.userCurrentBooking);
router.post('/user/processPayment', verifyToken, UserController.processPayment);
router.post('/invoice', verifyToken, UserController.getInvoice);
router.post('/CancelBooking', verifyToken, UserController.cancelBooking);
router.get('/user/profile', verifyToken, UserController.getUserProfile);
router.put('/user/profile/update', verifyToken, uploaduserprofile.single('profile'), UserController.updateUserProfile);
router.post('/user/recharge', verifyToken, UserController.userInitiateRecharge);
router.get('/user/recharge-history', verifyToken, UserController.getUserRechargeList);
router.post('/user/withdrawal-request', verifyToken, UserController.createWithdrawalRequest);
router.get('/user/withdrawal-history', verifyToken, UserController.getUserWithdrawalHistory);


//----------------------------------------------------Drivers Api-----------------------------------------------------------//
router.post('/send-otp', driver.sendDriverOTP);
router.post('/verify-otp', driver.verifyDriverLoginOTP);
router.post("/driver/register", driver.verifyDriverOTP );
router.post("/driver/upload-kyc",upload.any(),driver.uploadDriverKycDocument);
router.post('/driver-profile', uploadDriver.single('driver_profile'),driver.addDriverProfile);
router.get('/driver-profile-get', verifyToken, driver.getDriverProfile);
router.get('/getkyc_driver', verifyToken, driver.getDriverDocuments);
router.get("/driver/document_type", verifyToken,service.getServiceDocuments);
router.put('/driver/online-update-status', verifyToken, driver.updateOnlineStatus);
router.get('/driver/online-status', verifyToken, driver.getOnlineStatus);
router.post('/driver/update-location', verifyToken, driver.updateDriverLocation);
router.get('/driver/get-location', verifyToken, driver.getDriverLocation);
router.get('/driver/getbookingrequestlist', verifyToken, driver.getBookingRequests);
router.get('/driver/getdriverbookinghistory', verifyToken, driver.getDriverBookingHistory);
router.get('/driver/getCurrentBooking', verifyToken, driver.getCurrentBooking);
router.post('/driver/acceptBooking', verifyToken, driver.acceptBooking);
router.post('/driver/rejectBooking', verifyToken, driver.rejectBooking);
router.post('/driver/arrived', verifyToken, driver.driverArrived);
// router.post('/driver/bookingverifyOtp', verifyToken, driver.bookingverifyOtp);
router.post('/driver/bookingverifyOtp',verifyToken,meterimage.single('image'),driver.bookingverifyOtp);
router.post('/driver/requestTopup',verifyToken,meterimage.single('image'),driver.requestTopup);
router.post('/driver/verifyTopupOtp', verifyToken, driver.verifyTopupOtp);
router.post('/driver/completeRide',verifyToken,meterimage.single('image'),driver.completeRide);
router.get('/driver/wallet', verifyToken, driver.getDriverWallet);
router.post('/driver/recharge', verifyToken, driver.driverInitiateRecharge);
router.get('/driver/recharge-history', verifyToken, driver.getDriverRechargeHistory);
router.post('/driver/withdrawal-request', verifyToken, driver.createWithdrawalRequest);
router.get('/driver/withdrawal-history', verifyToken, driver.getDriverWithdrawalHistory);
router.post('/collect-payment-complete-ride',verifyToken,driver.collectPaymentAndCompleteRide);

router.post('/drivers/:id/recharge', driver.rechargeDriverWallet);
router.patch('/drivers/recharge/:id/status', driver.updateRechargeStatus);
router.get('/drivers/:id/recharges', driver.getDriverRechargesByAdmin);



//---------------------------------------------------------Bussiness Associate-------------------------------------------------------------//
router.post('/services',uploadService.fields([
       { name: 'image',  maxCount: 1 },
       { name: 'banner', maxCount: 1 },
  ]),
  service.createService
);

// router.post('/services', service.createService);
router.get('/getServiceById/:id', service.getServiceById);
router.get('/allservices', service.getAllServices);
router.put("/updateservices/:id", uploadService.fields([
  { name: "image", maxCount: 1 },
  { name: "banner", maxCount: 1 }
]), service.updateService);

router.patch("/servicestatus/:id/status",service.toggleServiceStatus)
router.delete("/servicedelete/:id",service.deleteService);
router.post("/create-sub-services", (req, res, next) => {
  uploadSubservice(req, res, (err) => {
    if (err) {
      console.error("❌ uploadSubservice multer error →", err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
    next();
  });
}, service.createSubService);
router.put("/update-sub-services/:id", (req, res, next) => {
  uploadSubservice(req, res, (err) => {
    if (err) {
      console.error("❌ uploadSubservice multer error →", err.message);
      return res.status(500).json({ status: false, error: err.message });
    }
    next();
  });
}, service.updateSubService);
router.get('/allsubservices/:id', service.getSubByServiceId);
router.get("/getsubservicelist",service.getAllSubServices);
router.delete("/deleteSubService/:id", service.deleteSubService);
router.patch("/:id/toggle",service.toggleSubServiceStatus);

router.get("/getAllServiceDocuments",service.getAllServiceDocuments);
router.get("/getServiceDocumentById/:id",service.getServiceDocumentById);
router.post("/createServiceDocument",service.createServiceDocument);
router.put("/updateServiceDocument/:id",service.updateServiceDocument);
router.delete("/deleteServiceDocument/:id", service.deleteServiceDocument);

//--------------------------------------------------bussiness_associate------------------------------------------------------------------//

router.post("/ba/register/otp", baController.sendOTP);
router.post("/ba/register", baController.verifyAndRegisterBA);
router.post("/ba/verify/login", baController.verifyOTPLogin);
router.post("/ba/add-services", verifyToken,baController.addBAServices);
router.get("/ba/services", verifyToken, baController.getBAServices);
router.post("/ba/create/driver", verifyToken, baController.createDriverByBA);
router.get("/ba/driverlist/", verifyToken, baController.getDriversByBA);
router.get("/ba/bookings", verifyToken, baController.getBABookings);
router.get("/ba/my-bookings", verifyToken, baController.getMyBABookings);
router.post("/ba/assign-driver", verifyToken, baController.assignDriverToBooking);
router.post("/ba/acceptbooking", verifyToken, baController.baacceptBooking);
router.post("/ba/rejectbooking", verifyToken, baController.baRejectBooking);
router.get("/bussinessassociates/list", baController.getBusinessAssociates);
router.get("/ba/:ba_id/drivers", baController.getDriversByBAAdmin);
router.get("/ba/:ba_id/drivers/:driver_id/bookings", baController.getDriverBookingHistoryByBAAdmin);
router.get("/ba/:ba_id/drivers-with-bookings", baController.getBADriversWithBookings);
router.get('/ba/current-booking', verifyToken,baController.getBACurrentBookings);
router.post("/ba/create",baController.createBusinessAssociate);
router.get("/ba/profile",verifyToken,baController.getBusinessAssociateProfile);
router.put("/ba/update",verifyToken,uploadBAProfile.single("profile_pic"),baController.updateBusinessAssociate);
router.delete("/ba/delete/:id",baController.deleteBusinessAssociate);
router.patch("/ba/:id/status",baController.changeBusinessAssociateStatus);

router.post("/ba/upload-kyc", verifyToken, upload.any(), baController.uploadBAKycDocument);
router.get("/ba/kyc", verifyToken, baController.getBADocuments);
router.get("/admin/business-associates/:id/documents", baController.getBADocumentsByAdmin);
router.patch("/admin/business-associates/:id/kyc/verify", baController.verifyBADocument);




router.get('/allplans',service.getAllPlans);
router.get('/plans/:service_id/sub-service/:sub_service_id',service.getPlansBySubService);
// router.get('/plans/sub-service/:sub_service_id', service.getPlansBySubService);
router.get('/getplan/:id',service.getPlanById);
router.post('/createplan', uploadplan.single('image'), service.createPlan);
router.put('/updateplan/:id',uploadplan.single('image'), service.updatePlan);
router.delete('/deleteplan/:id',service.deletePlan);
router.patch ('/planstatus/:id/status',service.togglePlanStatus);

//-----------------------------------------------------Admin_Api-----------------------------------------------------------------------------------//
router.get('/all/bookinghistory', bookingController.getBookingHistory);
router.get('/admin/bookings/:id/topups', bookingController.getBookingTopups);
router.delete('/booking/destroy/:booking_id', bookingController.destroyBooking);
router.get('/admin/withdrawal-requests', bookingController.getWithdrawalRequests);
router.patch('/admin/withdrawal-requests/:id/status', bookingController.updateWithdrawalStatus);

//-----------------------------------------------------Sigi Sharing---------------------------------------------------------------//

// User
router.get('/selfsharing/trips',                    verifyToken, selfSharingController.getAvailableTrips);
router.post('/selfsharing/booking/create',          verifyToken, selfSharingController.createBooking);
router.post('/selfsharing/booking/pay-full',        verifyToken, selfSharingController.payFullFare);
router.get('/selfsharing/booking/my-bookings',      verifyToken, selfSharingController.myBookings);
router.post('/selfsharing/booking/cancel',          verifyToken, selfSharingController.cancelBooking);
router.post('/selfsharing/booking/rating',          verifyToken, ratingController.submitSigiReview);

// Driver & BA
router.post('/selfsharing/trip/create',             verifyToken, selfSharingController.createTrip);
router.get('/selfsharing/trip/my-trips',            verifyToken, selfSharingController.myTrips);
router.post('/selfsharing/trip/assign-captain',     verifyToken, selfSharingController.assignCaptain);
router.get('/selfsharing/trip/:trip_id',   verifyToken, selfSharingController.getTripBookings);
router.post('/selfsharing/trip/arrive',             verifyToken, selfSharingController.markArrived);
router.post('/selfsharing/trip/verify-otp',         verifyToken, selfSharingController.verifyOtp);
router.post('/selfsharing/trip/start',              verifyToken, selfSharingController.startTrip);
router.post('/selfsharing/trip/complete',           verifyToken, selfSharingController.completeTrip);
router.post('/selfsharing/trip/cancel',             verifyToken, selfSharingController.cancelTrip);

// Admin
router.get('/admin/selfsharing/trips',              selfSharingController.adminGetAllTrips);
router.get('/admin/selfsharing/bookings',           selfSharingController.adminGetAllBookings);
router.get('/admin/parcel/bookings',                parcelController.adminGetAllBookings);

//-----------------------------------------------------Parcel---------------------------------------------------------------//

// User
router.post('/parcel/booking/create',               verifyToken, parcelController.createBooking);
router.get('/parcel/my-bookings',                   verifyToken, parcelController.myBookings);
router.get('/parcel/current-booking',               verifyToken, parcelController.currentBooking);
router.post('/parcel/booking/pay-token',            verifyToken, parcelController.payToken);
router.post('/parcel/booking/pay-balance',          verifyToken, parcelController.payBalance);
router.post('/parcel/booking/cancel',               verifyToken, parcelController.cancelBooking);

// Driver (captain)
router.get('/parcel/driver/available',              verifyToken, parcelController.availableParcels);
router.post('/parcel/driver/accept',                verifyToken, parcelController.acceptParcel);
router.post('/parcel/driver/arrive',                verifyToken, parcelController.arrive);
router.post('/parcel/driver/pickup-otp',            verifyToken, uploadParcel.single('pickup_image'),   parcelController.verifyPickupOtp);
router.post('/parcel/driver/delivery-otp',          verifyToken, uploadParcel.single('delivery_image'), parcelController.verifyDeliveryOtp);
router.get('/parcel/driver/my-deliveries',          verifyToken, parcelController.myDeliveries);
router.get('/parcel/driver/current-delivery',       verifyToken, parcelController.driverCurrentDelivery);
router.post('/parcel/driver/cancel',                verifyToken, parcelController.driverCancel);

// Business Associate
router.get('/parcel/ba/available',                  verifyToken, parcelController.baAvailableParcels);
router.post('/parcel/ba/accept-assign',             verifyToken, parcelController.baAcceptAndAssign);
router.get('/parcel/ba/list',                       verifyToken, parcelController.baParcels);
router.get('/parcel/ba/current',                    verifyToken, parcelController.baCurrentParcels);

// Shared (user / driver / BA — owner-checked inside)

router.post('/parcel/reject',                       verifyToken, parcelController.rejectParcel);
router.get('/parcel/booking/:parcel_booking_id',    verifyToken, parcelController.bookingDetail);

//-----------------------------------------------------On-spot service booking---------------------------------------------------------------//

// User
router.post('/onspot/booking/create',               verifyToken, onspotController.createBooking);
router.post('/onspot/booking/pay-token',            verifyToken, onspotController.payToken);
router.post('/onspot/booking/pay-full',             verifyToken, onspotController.payFull);
router.post('/onspot/booking/cancel',               verifyToken, onspotController.cancelBooking);
router.get('/onspot/my-bookings',                   verifyToken, onspotController.myBookings);
router.get('/onspot/current-booking',               verifyToken, onspotController.currentBooking);


router.get('/onspot/captain/available',              verifyToken, onspotController.availableBookings);
router.post('/onspot/captain/accept',                verifyToken, onspotController.acceptBooking);
router.post('/onspot/captain/reject',                verifyToken, onspotController.rejectBooking);
router.post('/onspot/captain/arrive',                verifyToken, onspotController.arrive);
router.post('/onspot/captain/verify-otp',            verifyToken, onspotController.verifyOtp);
router.post('/onspot/captain/complete',              verifyToken, onspotController.completeBooking);
router.post('/onspot/captain/cancel',                verifyToken, onspotController.driverCancel);
router.get('/onspot/captain/mybooking',                verifyToken, onspotController.myJobs);
router.get('/onspot/captain/currentbooking',            verifyToken, onspotController.driverCurrentJob);


router.get('/onspot/booking/:booking_no',           verifyToken, onspotController.bookingDetail);

// Admin
router.get('/admin/onspot/bookings',                onspotController.adminGetAllBookings);

//-----------------------------------------------------Pages---------------------------------------------------------------//
router.get('/pages', pagesController.getAllPages);
router.post('/pages/by-role', pagesController.getPagesByRole);
router.get('/pages/slug/:slug', pagesController.getPageBySlug);
router.get('/pages/:id', pagesController.getPageById);
router.post('/pages', pagesController.createPage);
router.put('/pages/:id', pagesController.updatePage);
router.delete('/pages/:id', pagesController.deletePage);
router.patch('/pages/:id/status', pagesController.togglePageStatus);

//-------------------------------------------------Landing page (CMS)-------------------------------------------------------//

// Generic image upload → returns a usable URL (used by card items, etc.)
router.post('/admin/upload', uploadLanding.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ status: false, message: 'No file uploaded' });
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.get('host')}/uploads/landing/${req.file.filename}`;
  return res.json({ status: true, url, filename: req.file.filename });
});

router.get('/landing', landingController.getLandingPage);

router.get('/admin/landing', landingController.adminGetAllSections);
router.get('/admin/landing/:id', landingController.getSectionById);
router.post('/admin/landing', uploadLanding.single('image'), landingController.createSection);
router.patch('/admin/landing/reorder', landingController.reorderSections);
router.put('/admin/landing/:id', uploadLanding.single('image'), landingController.updateSection);
router.patch('/admin/landing/:id/status', landingController.toggleSectionStatus);
router.delete('/admin/landing/:id', landingController.deleteSection);

//-------------------------------------------------Contact / Enquiry-------------------------------------------------------//
router.post('/contact', contactController.createContact);                 // public
router.get('/admin/contacts', contactController.getContacts);
router.patch('/admin/contacts/:id/status', contactController.updateContactStatus);
router.delete('/admin/contacts/:id', contactController.deleteContact);

//-------------------------------------------------Pop-up Messages (CMS)----------------------------------------------------//
// public  (audience = 'user' or 'captain')
router.get('/popups/:audience', popupController.getPopupsByAudience);
// admin
router.get('/admin/popups', popupController.adminGetAllPopups);
router.get('/admin/popups/:id', popupController.getPopupById);
router.post('/admin/popups', uploadPopup.single('image'), popupController.createPopup);
router.put('/admin/popups/:id', uploadPopup.single('image'), popupController.updatePopup);
router.patch('/admin/popups/:id/status', popupController.togglePopupStatus);
router.delete('/admin/popups/:id', popupController.deletePopup);

//-------------------------------------------------App Slider Banners (CMS)-------------------------------------------------//
// public
router.get('/app-banners', appBannerController.getAppBanners);
// admin
router.get('/admin/app-banners', appBannerController.adminGetAllAppBanners);
router.post('/admin/app-banners', uploadAppBanner.single('image'), appBannerController.createAppBanner);
router.put('/admin/app-banners/:id', uploadAppBanner.single('image'), appBannerController.updateAppBanner);
router.patch('/admin/app-banners/:id/status', appBannerController.toggleAppBannerStatus);
router.delete('/admin/app-banners/:id', appBannerController.deleteAppBanner);

//-------------------------------------------------Notification Messages (CMS)----------------------------------------------//
// public  (audience = 'user' or 'captain')
router.get('/notifications/:audience', notificationController.getNotificationsByAudience);
// admin
router.get('/admin/notifications', notificationController.adminGetAllNotifications);
router.get('/admin/notifications/:id', notificationController.getNotificationById);
router.post('/admin/notifications', uploadNotification.single('image'), notificationController.createNotification);
router.post('/admin/notifications/:id/send', notificationController.sendNotificationPush);
router.put('/admin/notifications/:id', uploadNotification.single('image'), notificationController.updateNotification);
router.patch('/admin/notifications/:id/status', notificationController.toggleNotificationStatus);
router.delete('/admin/notifications/:id', notificationController.deleteNotification);
router.get('/admin/admin-notifications', adminNotificationController.getAdminNotifications);

//-------------------------------------------------Driver Rating & Review---------------------------------------------------//
router.post('/user/driver/rating', verifyToken, ratingController.submitDriverReview);   // user rates the captain (ride)
router.post('/onspot/rating', verifyToken, ratingController.submitOnspotReview);         // user rates the captain (on-spot)
router.post('/parcel/rating', verifyToken, ratingController.submitParcelReview);         // user rates the captain (parcel)
router.get('/driver/reviews', verifyToken, ratingController.getMyDriverReviews);         // captain views own reviews
router.get('/driver/reviews/:driver_id', ratingController.getDriverReviewsById);         // public: a captain's reviews

router.get('/admin/booking-rejections', verifyToken, bookingController.getBookingRejections);
router.get('/admin/driver-documents', verifyToken, driver.getAllDriverDocuments);

//-------------------------------------------------Chat Support--------------------------------------------------------------//
// user / captain — their own support conversation with admin
router.get('/support/conversation',  verifyToken, chatController.getMyConversation);
router.post('/support/send',         verifyToken, chatController.sendMessage);

// admin — support inbox
router.get('/admin/support/conversations',            verifyToken, chatController.adminGetConversations);
router.get('/admin/support/conversations/:id/messages', verifyToken, chatController.adminGetMessages);
router.post('/admin/support/conversations/:id/send',    verifyToken, chatController.adminSendMessage);
router.patch('/admin/support/conversations/:id/close',  verifyToken, chatController.adminCloseConversation);
router.patch('/admin/support/conversations/:id/reopen', verifyToken, chatController.adminReopenConversation);


module.exports = router;
