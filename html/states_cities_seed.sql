-- ════════════════════════════════════════════════════════════════════════════
--  India States / Union Territories + major cities  →  two tables: states, cities
--
--  Creates both tables (if missing) then seeds them. Cities reference their state
--  by a user-variable lookup on the state name, so it does not depend on auto IDs.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── TABLES ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    KEY idx_status (status)
);

CREATE TABLE IF NOT EXISTS cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    state_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    status TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    KEY idx_state (state_id),
    KEY idx_status (status)
);

-- ─── STATES (28) ───────────────────────────────────────────────────────────────
INSERT INTO states (name, status, created_at, updated_at) VALUES
('Andhra Pradesh',1,NOW(),NOW()),
('Arunachal Pradesh',1,NOW(),NOW()),
('Assam',1,NOW(),NOW()),
('Bihar',1,NOW(),NOW()),
('Chhattisgarh',1,NOW(),NOW()),
('Goa',1,NOW(),NOW()),
('Gujarat',1,NOW(),NOW()),
('Haryana',1,NOW(),NOW()),
('Himachal Pradesh',1,NOW(),NOW()),
('Jharkhand',1,NOW(),NOW()),
('Karnataka',1,NOW(),NOW()),
('Kerala',1,NOW(),NOW()),
('Madhya Pradesh',1,NOW(),NOW()),
('Maharashtra',1,NOW(),NOW()),
('Manipur',1,NOW(),NOW()),
('Meghalaya',1,NOW(),NOW()),
('Mizoram',1,NOW(),NOW()),
('Nagaland',1,NOW(),NOW()),
('Odisha',1,NOW(),NOW()),
('Punjab',1,NOW(),NOW()),
('Rajasthan',1,NOW(),NOW()),
('Sikkim',1,NOW(),NOW()),
('Tamil Nadu',1,NOW(),NOW()),
('Telangana',1,NOW(),NOW()),
('Tripura',1,NOW(),NOW()),
('Uttar Pradesh',1,NOW(),NOW()),
('Uttarakhand',1,NOW(),NOW()),
('West Bengal',1,NOW(),NOW());

-- ─── UNION TERRITORIES (8) ──────────────────────────────────────────────────────
INSERT INTO states (name, status, created_at, updated_at) VALUES
('Andaman and Nicobar Islands',1,NOW(),NOW()),
('Chandigarh',1,NOW(),NOW()),
('Dadra and Nagar Haveli and Daman and Diu',1,NOW(),NOW()),
('Delhi',1,NOW(),NOW()),
('Jammu and Kashmir',1,NOW(),NOW()),
('Ladakh',1,NOW(),NOW()),
('Lakshadweep',1,NOW(),NOW()),
('Puducherry',1,NOW(),NOW());

-- ════════════════════════════════════════════════════════════════════════════
--  CITIES  (major cities / districts per state)
-- ════════════════════════════════════════════════════════════════════════════

-- Andhra Pradesh
SET @s := (SELECT id FROM states WHERE name='Andhra Pradesh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Visakhapatnam',1,NOW(),NOW()),(@s,'Vijayawada',1,NOW(),NOW()),
(@s,'Guntur',1,NOW(),NOW()),(@s,'Nellore',1,NOW(),NOW()),
(@s,'Kurnool',1,NOW(),NOW()),(@s,'Rajahmundry',1,NOW(),NOW()),
(@s,'Tirupati',1,NOW(),NOW()),(@s,'Kakinada',1,NOW(),NOW()),
(@s,'Kadapa',1,NOW(),NOW()),(@s,'Anantapur',1,NOW(),NOW());

-- Arunachal Pradesh
SET @s := (SELECT id FROM states WHERE name='Arunachal Pradesh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Itanagar',1,NOW(),NOW()),(@s,'Naharlagun',1,NOW(),NOW()),
(@s,'Pasighat',1,NOW(),NOW()),(@s,'Tawang',1,NOW(),NOW()),
(@s,'Ziro',1,NOW(),NOW());

-- Assam
SET @s := (SELECT id FROM states WHERE name='Assam' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Guwahati',1,NOW(),NOW()),(@s,'Silchar',1,NOW(),NOW()),
(@s,'Dibrugarh',1,NOW(),NOW()),(@s,'Jorhat',1,NOW(),NOW()),
(@s,'Nagaon',1,NOW(),NOW()),(@s,'Tinsukia',1,NOW(),NOW()),
(@s,'Tezpur',1,NOW(),NOW());

-- Bihar
SET @s := (SELECT id FROM states WHERE name='Bihar' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Patna',1,NOW(),NOW()),(@s,'Gaya',1,NOW(),NOW()),
(@s,'Bhagalpur',1,NOW(),NOW()),(@s,'Muzaffarpur',1,NOW(),NOW()),
(@s,'Darbhanga',1,NOW(),NOW()),(@s,'Purnia',1,NOW(),NOW()),
(@s,'Arrah',1,NOW(),NOW()),(@s,'Begusarai',1,NOW(),NOW()),
(@s,'Katihar',1,NOW(),NOW());

-- Chhattisgarh
SET @s := (SELECT id FROM states WHERE name='Chhattisgarh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Raipur',1,NOW(),NOW()),(@s,'Bhilai',1,NOW(),NOW()),
(@s,'Bilaspur',1,NOW(),NOW()),(@s,'Korba',1,NOW(),NOW()),
(@s,'Durg',1,NOW(),NOW()),(@s,'Raigarh',1,NOW(),NOW()),
(@s,'Jagdalpur',1,NOW(),NOW()),(@s,'Ambikapur',1,NOW(),NOW());

-- Goa
SET @s := (SELECT id FROM states WHERE name='Goa' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Panaji',1,NOW(),NOW()),(@s,'Margao',1,NOW(),NOW()),
(@s,'Vasco da Gama',1,NOW(),NOW()),(@s,'Mapusa',1,NOW(),NOW()),
(@s,'Ponda',1,NOW(),NOW());

-- Gujarat
SET @s := (SELECT id FROM states WHERE name='Gujarat' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Ahmedabad',1,NOW(),NOW()),(@s,'Surat',1,NOW(),NOW()),
(@s,'Vadodara',1,NOW(),NOW()),(@s,'Rajkot',1,NOW(),NOW()),
(@s,'Bhavnagar',1,NOW(),NOW()),(@s,'Jamnagar',1,NOW(),NOW()),
(@s,'Gandhinagar',1,NOW(),NOW()),(@s,'Junagadh',1,NOW(),NOW()),
(@s,'Anand',1,NOW(),NOW()),(@s,'Bharuch',1,NOW(),NOW());

-- Haryana
SET @s := (SELECT id FROM states WHERE name='Haryana' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Faridabad',1,NOW(),NOW()),(@s,'Gurugram',1,NOW(),NOW()),
(@s,'Panipat',1,NOW(),NOW()),(@s,'Ambala',1,NOW(),NOW()),
(@s,'Yamunanagar',1,NOW(),NOW()),(@s,'Rohtak',1,NOW(),NOW()),
(@s,'Hisar',1,NOW(),NOW()),(@s,'Karnal',1,NOW(),NOW()),
(@s,'Sonipat',1,NOW(),NOW()),(@s,'Panchkula',1,NOW(),NOW());

-- Himachal Pradesh
SET @s := (SELECT id FROM states WHERE name='Himachal Pradesh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Shimla',1,NOW(),NOW()),(@s,'Mandi',1,NOW(),NOW()),
(@s,'Solan',1,NOW(),NOW()),(@s,'Dharamshala',1,NOW(),NOW()),
(@s,'Kullu',1,NOW(),NOW()),(@s,'Bilaspur',1,NOW(),NOW()),
(@s,'Hamirpur',1,NOW(),NOW()),(@s,'Una',1,NOW(),NOW());

-- Jharkhand
SET @s := (SELECT id FROM states WHERE name='Jharkhand' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Ranchi',1,NOW(),NOW()),(@s,'Jamshedpur',1,NOW(),NOW()),
(@s,'Dhanbad',1,NOW(),NOW()),(@s,'Bokaro',1,NOW(),NOW()),
(@s,'Deoghar',1,NOW(),NOW()),(@s,'Hazaribagh',1,NOW(),NOW()),
(@s,'Giridih',1,NOW(),NOW()),(@s,'Ramgarh',1,NOW(),NOW());

-- Karnataka
SET @s := (SELECT id FROM states WHERE name='Karnataka' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Bengaluru',1,NOW(),NOW()),(@s,'Mysuru',1,NOW(),NOW()),
(@s,'Hubballi',1,NOW(),NOW()),(@s,'Mangaluru',1,NOW(),NOW()),
(@s,'Belagavi',1,NOW(),NOW()),(@s,'Kalaburagi',1,NOW(),NOW()),
(@s,'Davanagere',1,NOW(),NOW()),(@s,'Ballari',1,NOW(),NOW()),
(@s,'Shivamogga',1,NOW(),NOW()),(@s,'Tumakuru',1,NOW(),NOW());

-- Kerala
SET @s := (SELECT id FROM states WHERE name='Kerala' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Thiruvananthapuram',1,NOW(),NOW()),(@s,'Kochi',1,NOW(),NOW()),
(@s,'Kozhikode',1,NOW(),NOW()),(@s,'Thrissur',1,NOW(),NOW()),
(@s,'Kollam',1,NOW(),NOW()),(@s,'Kannur',1,NOW(),NOW()),
(@s,'Alappuzha',1,NOW(),NOW()),(@s,'Palakkad',1,NOW(),NOW()),
(@s,'Kottayam',1,NOW(),NOW()),(@s,'Malappuram',1,NOW(),NOW());

-- Madhya Pradesh
SET @s := (SELECT id FROM states WHERE name='Madhya Pradesh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Bhopal',1,NOW(),NOW()),(@s,'Indore',1,NOW(),NOW()),
(@s,'Jabalpur',1,NOW(),NOW()),(@s,'Gwalior',1,NOW(),NOW()),
(@s,'Ujjain',1,NOW(),NOW()),(@s,'Sagar',1,NOW(),NOW()),
(@s,'Satna',1,NOW(),NOW()),(@s,'Rewa',1,NOW(),NOW()),
(@s,'Ratlam',1,NOW(),NOW()),(@s,'Dewas',1,NOW(),NOW());

-- Maharashtra
SET @s := (SELECT id FROM states WHERE name='Maharashtra' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Mumbai',1,NOW(),NOW()),(@s,'Pune',1,NOW(),NOW()),
(@s,'Nagpur',1,NOW(),NOW()),(@s,'Nashik',1,NOW(),NOW()),
(@s,'Thane',1,NOW(),NOW()),(@s,'Aurangabad',1,NOW(),NOW()),
(@s,'Solapur',1,NOW(),NOW()),(@s,'Kolhapur',1,NOW(),NOW()),
(@s,'Amravati',1,NOW(),NOW()),(@s,'Navi Mumbai',1,NOW(),NOW()),
(@s,'Sangli',1,NOW(),NOW()),(@s,'Jalgaon',1,NOW(),NOW());

-- Manipur
SET @s := (SELECT id FROM states WHERE name='Manipur' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Imphal',1,NOW(),NOW()),(@s,'Thoubal',1,NOW(),NOW()),
(@s,'Bishnupur',1,NOW(),NOW()),(@s,'Churachandpur',1,NOW(),NOW());

-- Meghalaya
SET @s := (SELECT id FROM states WHERE name='Meghalaya' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Shillong',1,NOW(),NOW()),(@s,'Tura',1,NOW(),NOW()),
(@s,'Jowai',1,NOW(),NOW()),(@s,'Nongstoin',1,NOW(),NOW());

-- Mizoram
SET @s := (SELECT id FROM states WHERE name='Mizoram' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Aizawl',1,NOW(),NOW()),(@s,'Lunglei',1,NOW(),NOW()),
(@s,'Champhai',1,NOW(),NOW()),(@s,'Serchhip',1,NOW(),NOW());

-- Nagaland
SET @s := (SELECT id FROM states WHERE name='Nagaland' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Kohima',1,NOW(),NOW()),(@s,'Dimapur',1,NOW(),NOW()),
(@s,'Mokokchung',1,NOW(),NOW()),(@s,'Tuensang',1,NOW(),NOW());

-- Odisha
SET @s := (SELECT id FROM states WHERE name='Odisha' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Bhubaneswar',1,NOW(),NOW()),(@s,'Cuttack',1,NOW(),NOW()),
(@s,'Rourkela',1,NOW(),NOW()),(@s,'Berhampur',1,NOW(),NOW()),
(@s,'Sambalpur',1,NOW(),NOW()),(@s,'Puri',1,NOW(),NOW()),
(@s,'Balasore',1,NOW(),NOW()),(@s,'Bhadrak',1,NOW(),NOW());

-- Punjab
SET @s := (SELECT id FROM states WHERE name='Punjab' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Ludhiana',1,NOW(),NOW()),(@s,'Amritsar',1,NOW(),NOW()),
(@s,'Jalandhar',1,NOW(),NOW()),(@s,'Patiala',1,NOW(),NOW()),
(@s,'Bathinda',1,NOW(),NOW()),(@s,'Mohali',1,NOW(),NOW()),
(@s,'Hoshiarpur',1,NOW(),NOW()),(@s,'Pathankot',1,NOW(),NOW()),
(@s,'Moga',1,NOW(),NOW());

-- Rajasthan
SET @s := (SELECT id FROM states WHERE name='Rajasthan' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Jaipur',1,NOW(),NOW()),(@s,'Jodhpur',1,NOW(),NOW()),
(@s,'Udaipur',1,NOW(),NOW()),(@s,'Kota',1,NOW(),NOW()),
(@s,'Bikaner',1,NOW(),NOW()),(@s,'Ajmer',1,NOW(),NOW()),
(@s,'Bhilwara',1,NOW(),NOW()),(@s,'Alwar',1,NOW(),NOW()),
(@s,'Sikar',1,NOW(),NOW()),(@s,'Sri Ganganagar',1,NOW(),NOW());

-- Sikkim
SET @s := (SELECT id FROM states WHERE name='Sikkim' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Gangtok',1,NOW(),NOW()),(@s,'Namchi',1,NOW(),NOW()),
(@s,'Gyalshing',1,NOW(),NOW()),(@s,'Mangan',1,NOW(),NOW());

-- Tamil Nadu
SET @s := (SELECT id FROM states WHERE name='Tamil Nadu' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Chennai',1,NOW(),NOW()),(@s,'Coimbatore',1,NOW(),NOW()),
(@s,'Madurai',1,NOW(),NOW()),(@s,'Tiruchirappalli',1,NOW(),NOW()),
(@s,'Salem',1,NOW(),NOW()),(@s,'Tirunelveli',1,NOW(),NOW()),
(@s,'Tiruppur',1,NOW(),NOW()),(@s,'Erode',1,NOW(),NOW()),
(@s,'Vellore',1,NOW(),NOW()),(@s,'Thoothukudi',1,NOW(),NOW());

-- Telangana
SET @s := (SELECT id FROM states WHERE name='Telangana' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Hyderabad',1,NOW(),NOW()),(@s,'Warangal',1,NOW(),NOW()),
(@s,'Nizamabad',1,NOW(),NOW()),(@s,'Karimnagar',1,NOW(),NOW()),
(@s,'Khammam',1,NOW(),NOW()),(@s,'Ramagundam',1,NOW(),NOW()),
(@s,'Mahbubnagar',1,NOW(),NOW()),(@s,'Nalgonda',1,NOW(),NOW());

-- Tripura
SET @s := (SELECT id FROM states WHERE name='Tripura' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Agartala',1,NOW(),NOW()),(@s,'Udaipur',1,NOW(),NOW()),
(@s,'Dharmanagar',1,NOW(),NOW()),(@s,'Kailashahar',1,NOW(),NOW());

-- Uttar Pradesh
SET @s := (SELECT id FROM states WHERE name='Uttar Pradesh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Lucknow',1,NOW(),NOW()),(@s,'Kanpur',1,NOW(),NOW()),
(@s,'Ghaziabad',1,NOW(),NOW()),(@s,'Agra',1,NOW(),NOW()),
(@s,'Varanasi',1,NOW(),NOW()),(@s,'Meerut',1,NOW(),NOW()),
(@s,'Prayagraj',1,NOW(),NOW()),(@s,'Bareilly',1,NOW(),NOW()),
(@s,'Aligarh',1,NOW(),NOW()),(@s,'Moradabad',1,NOW(),NOW()),
(@s,'Noida',1,NOW(),NOW()),(@s,'Gorakhpur',1,NOW(),NOW());

-- Uttarakhand
SET @s := (SELECT id FROM states WHERE name='Uttarakhand' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Dehradun',1,NOW(),NOW()),(@s,'Haridwar',1,NOW(),NOW()),
(@s,'Roorkee',1,NOW(),NOW()),(@s,'Haldwani',1,NOW(),NOW()),
(@s,'Rudrapur',1,NOW(),NOW()),(@s,'Kashipur',1,NOW(),NOW()),
(@s,'Rishikesh',1,NOW(),NOW()),(@s,'Nainital',1,NOW(),NOW());

-- West Bengal
SET @s := (SELECT id FROM states WHERE name='West Bengal' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Kolkata',1,NOW(),NOW()),(@s,'Howrah',1,NOW(),NOW()),
(@s,'Durgapur',1,NOW(),NOW()),(@s,'Asansol',1,NOW(),NOW()),
(@s,'Siliguri',1,NOW(),NOW()),(@s,'Bardhaman',1,NOW(),NOW()),
(@s,'Malda',1,NOW(),NOW()),(@s,'Kharagpur',1,NOW(),NOW()),
(@s,'Haldia',1,NOW(),NOW()),(@s,'Darjeeling',1,NOW(),NOW());

-- Andaman and Nicobar Islands
SET @s := (SELECT id FROM states WHERE name='Andaman and Nicobar Islands' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Port Blair',1,NOW(),NOW()),(@s,'Diglipur',1,NOW(),NOW()),
(@s,'Mayabunder',1,NOW(),NOW());

-- Chandigarh
SET @s := (SELECT id FROM states WHERE name='Chandigarh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Chandigarh',1,NOW(),NOW());

-- Dadra and Nagar Haveli and Daman and Diu
SET @s := (SELECT id FROM states WHERE name='Dadra and Nagar Haveli and Daman and Diu' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Daman',1,NOW(),NOW()),(@s,'Diu',1,NOW(),NOW()),
(@s,'Silvassa',1,NOW(),NOW());

-- Delhi
SET @s := (SELECT id FROM states WHERE name='Delhi' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'New Delhi',1,NOW(),NOW()),(@s,'North Delhi',1,NOW(),NOW()),
(@s,'South Delhi',1,NOW(),NOW()),(@s,'East Delhi',1,NOW(),NOW()),
(@s,'West Delhi',1,NOW(),NOW()),(@s,'Dwarka',1,NOW(),NOW());

-- Jammu and Kashmir
SET @s := (SELECT id FROM states WHERE name='Jammu and Kashmir' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Srinagar',1,NOW(),NOW()),(@s,'Jammu',1,NOW(),NOW()),
(@s,'Anantnag',1,NOW(),NOW()),(@s,'Baramulla',1,NOW(),NOW()),
(@s,'Udhampur',1,NOW(),NOW()),(@s,'Kathua',1,NOW(),NOW());

-- Ladakh
SET @s := (SELECT id FROM states WHERE name='Ladakh' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Leh',1,NOW(),NOW()),(@s,'Kargil',1,NOW(),NOW());

-- Lakshadweep
SET @s := (SELECT id FROM states WHERE name='Lakshadweep' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Kavaratti',1,NOW(),NOW()),(@s,'Agatti',1,NOW(),NOW()),
(@s,'Minicoy',1,NOW(),NOW());

-- Puducherry
SET @s := (SELECT id FROM states WHERE name='Puducherry' LIMIT 1);
INSERT INTO cities (state_id,name,status,created_at,updated_at) VALUES
(@s,'Puducherry',1,NOW(),NOW()),(@s,'Karaikal',1,NOW(),NOW()),
(@s,'Yanam',1,NOW(),NOW()),(@s,'Mahe',1,NOW(),NOW());
