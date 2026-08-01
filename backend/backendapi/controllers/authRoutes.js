// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const service = require('../controllers/serviceController');
const driver = require('../controllers/driverController');
const baController = require("../controllers/businessAssociate");
const bookingController = require("../controllers/bookingController");
const UserController = require("../controllers/UserapiController");
const authMiddleware = require('../middleware/authMiddleware'); 
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");
const meterimage = require("../middleware/meter_image");
const uploadDriver = require('../middleware/uploadDriverProfile');
const uploadService = require('../middleware/uploadservice');
const uploadSubservice = require('../middleware/uploadsubservice');
const uploaduserprofile = require('../middleware/uploaduserprofile');
const uploadplan = require('../middleware/uploadplan');

//---------------------------------------------------Admin-panel---------------------------------------------------------------//
router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/users', authMiddleware, auth.getUsers);
router.get('/userlist', UserController.userList);
router.get('/driverlist', driver.driverList);
router.delete('/drivers/:id', driver.deleteDriver);
router.get('/drivers/:id', driver.getDriverById);
router.put('/drivers/:id', driver.updateDriver);
router.post('/drivers',     driver.createDriver);

//-----------------------------------------------------Users Api---------------------------------------------------------------//

router.post('/user/send-otp', auth.sendOTP);
router.post('/user/verify-otp', auth.verifyOTP);
router.post('/user/bookingrequest', verifyToken,bookingController.createBookingRequest);
router.post('/user/getplan', verifyToken,bookingController.getPlans);
router.post('/user/paytokenamount', verifyToken,UserController.payToken);
router.post('/user/payremainingBalance', verifyToken,UserController.payBalance);
router.post('/user/payTopup', verifyToken, UserController.payTopup);
router.get('/user/bookinghistory', verifyToken, UserController.userBookingHistory);
router.get('/user/userCurrentBooking', verifyToken, UserController.userCurrentBooking);
router.post('/CancelBooking', verifyToken, UserController.cancelBooking);
router.get('/user/profile', verifyToken, UserController.getUserProfile);
router.put('/user/profile/update', verifyToken, uploaduserprofile.single('profile'), UserController.updateUserProfile);


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
router.get('/driver/getbookingrequestlist', verifyToken, driver.getBookingRequests);
router.get('/driver/getdriverbookinghistory', verifyToken, driver.getDriverBookingHistory);
router.get('/driver/getCurrentBooking', verifyToken, driver.getCurrentBooking);
router.post('/driver/acceptBooking', verifyToken, driver.acceptBooking);
router.post('/driver/arrived', verifyToken, driver.driverArrived);
// router.post('/driver/bookingverifyOtp', verifyToken, driver.bookingverifyOtp);
router.post('/driver/bookingverifyOtp',verifyToken,meterimage.single('image'),driver.bookingverifyOtp);
router.post('/driver/requestTopup',verifyToken,meterimage.single('image'),driver.requestTopup);
router.post('/driver/verifyTopupOtp', verifyToken, driver.verifyTopupOtp);
router.post('/driver/completeRide',verifyToken,meterimage.single('image'),driver.completeRide);


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
router.post("/create-sub-services",uploadSubservice,service.createSubService);
router.put("/update-sub-services/:id", uploadSubservice, service.updateSubService);
router.get('/allsubservices/:id', service.getSubByServiceId);
router.get("/getsubservicelist",service.getAllSubServices);
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
router.get("/bussinessassociates/list", baController.getBusinessAssociates);
router.get('/ba/current-booking', verifyToken,baController.getBACurrentBookings);
router.post("/ba/create",baController.createBusinessAssociate);
router.put("/ba/update/:id",baController.updateBusinessAssociate);
router.delete("/ba/delete/:id",baController.deleteBusinessAssociate);
router.patch("/ba/:id/status",baController.changeBusinessAssociateStatus);




router.get('/allplans',service.getAllPlans);
router.get('/getplan/:id',service.getPlanById);
router.post('/createplan', uploadplan.single('image'), service.createPlan);
router.put('/updateplan/:id',uploadplan.single('image'), service.updatePlan);
router.delete('/deleteplan/:id',service.deletePlan);
router.patch ('/planstatus/:id/status',service.togglePlanStatus);

//-----------------------------------------------------Admin_Api-----------------------------------------------------------------------------------//
router.get('/all/bookinghistory', bookingController.getBookingHistory);
router.get('/admin/booking-rejections', verifyToken, bookingController.getBookingRejections);
router.get('/admin/driver-documents', verifyToken, driver.getAllDriverDocuments);

module.exports = router;