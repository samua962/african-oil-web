// @ts-nocheck
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Language = 'en' | 'am'
type Messages = Record<string, string>

const am: Messages = {
  'Store overview': 'የመደብር አጠቃላይ እይታ', Operations: 'ሥራዎች', 'Sales checkout': 'የሽያጭ ማስመዝገቢያ', Cashier: 'ገንዘብ ተቀባይ', 'Shift reconciliation': 'የፈረቃ ሂሳብ ማስታረቅ', Inventory: 'የእቃ ክምችት', Catalog: 'የምርት ዝርዝር', 'Stock movements': 'የክምችት እንቅስቃሴዎች', 'Inventory control': 'የክምችት ቁጥጥር', 'User management': 'የተጠቃሚ አስተዳደር', Administration: 'አስተዳደር', 'Audit log': 'የኦዲት መዝገብ', Reports: 'ሪፖርቶች', Insights: 'ትንታኔ', Purchasing: 'ግዢ', 'My profile': 'የእኔ መገለጫ', Account: 'መለያ',
  Store: 'መደብር', Overview: 'አጠቃላይ እይታ', 'POS sales': 'የሽያጭ ማስመዝገቢያ', Users: 'ተጠቃሚዎች', 'Sign out': 'ውጣ', 'Close navigation': 'ማሰሻውን ዝጋ', 'Open navigation': 'ማሰሻውን ክፈት', 'Checking connection': 'ግንኙነት በመፈተሽ ላይ', Connected: 'ተገናኝቷል', 'Connection unavailable': 'ግንኙነት የለም',
  'Staff sign-in': 'የሰራተኛ መግቢያ', 'Welcome back': 'እንኳን ደህና መጡ', 'Sign in with your station account.': 'በስቴሽን መለያዎ ይግቡ።', Username: 'የተጠቃሚ ስም', Password: 'የይለፍ ቃል', 'Forgot password?': 'የይለፍ ቃል ረሱ?', 'Show password': 'የይለፍ ቃሉን አሳይ', 'Hide password': 'የይለፍ ቃሉን ደብቅ', 'Sign in': 'ግባ', 'Signing in…': 'በመግባት ላይ…', 'Secure station access': 'የተጠበቀ የስቴሽን መግቢያ', 'No account? Contact your administrator.': 'መለያ የለዎትም? አስተዳዳሪዎን ያነጋግሩ።',
  'Store operations start here.': 'የመደብር ሥራ እዚህ ይጀምራል።', 'Secure access for African Oil retail teams.': 'ለAfrican Oil የችርቻሮ ቡድኖች የተጠበቀ መግቢያ።', 'AFRICAN OIL · RETAIL SYSTEM': 'AFRICAN OIL · የችርቻሮ ስርዓት',
  'Point of sale': 'የሽያጭ ቦታ', 'Process quick sales and update stock automatically.': 'ሽያጭን በፍጥነት ያስመዝግቡ፤ ክምችት በራስ-ሰር ይዘምናል።', 'Sale items': 'የሽያጭ ዕቃዎች', 'Quick add by name, SKU or barcode': 'በስም፣ SKU ወይም ባርኮድ ፈጣን ጨምር', 'Scan barcode or search a product': 'ባርኮድ ይቃኙ ወይም ምርት ይፈልጉ', 'Add item': 'ዕቃ ጨምር', Product: 'ምርት', Quantity: 'ብዛት', 'Payment method': 'የክፍያ ዘዴ', Total: 'ጠቅላላ', 'Complete sale': 'ሽያጩን አጠናቅቅ', 'Processing…': 'በማስኬድ ላይ…', 'Recent sales': 'የቅርብ ጊዜ ሽያጮች', 'No sales recorded yet.': 'እስካሁን ሽያጭ አልተመዘገበም።', 'Receipt': 'ደረሰኝ', Void: 'ሰርዝ', 'Confirm void': 'ስረዛውን አረጋግጥ', 'Reason for void (required)': 'የስረዛ ምክንያት (አስፈላጊ)',
  'Cashier controls': 'የገንዘብ ተቀባይ ቁጥጥር', 'Review payment totals, count stock, and close the till.': 'የክፍያ ድምርን ይመልከቱ፣ ክምችትን ይቁጠሩ እና ፈረቃውን ይዝጉ።', 'No shift is open': 'የተከፈተ ፈረቃ የለም', 'Open shift': 'ፈረቃ ክፈት', 'Opening cash float (ETB)': 'የመክፈቻ ገንዘብ (ብር)', 'Shift open': 'ፈረቃ ተከፍቷል', Active: 'ንቁ', 'Opening float': 'የመክፈቻ ገንዘብ', Sales: 'ሽያጮች', 'Sales total': 'የሽያጭ ድምር', 'Expected cash': 'የሚጠበቅ ገንዘብ', 'Count variances': 'የቆጠራ ልዩነቶች', 'Physical stock count': 'የክምችት ቆጠራ', 'Expected quantities include this shift’s sales, receipts, and losses.': 'የሚጠበቁ ብዛቶች የዚህ ፈረቃ ሽያጭ፣ ገቢ እና ኪሳራ ያካትታሉ።', 'At opening': 'ሲከፈት', Expected: 'የሚጠበቅ', 'Physical count': 'ትክክለኛ ቆጠራ', Variance: 'ልዩነት', 'Close shift & reconcile': 'ፈረቃውን ዝጋ እና አስታርቅ', 'Closed shifts': 'የተዘጉ ፈረቃዎች', Closed: 'ተዘግቷል', Cashier: 'ገንዘብ ተቀባይ', 'Cash variance': 'የገንዘብ ልዩነት', 'Stock variances': 'የክምችት ልዩነቶች', Print: 'አትም', Refresh: 'አድስ',
  'Insights': 'ትንታኔ', 'Sales, profit and expiring stock. Profit uses current cost prices.': 'ሽያጭ፣ ትርፍ እና ጊዜያቸው የሚያበቃ ክምችት። ትርፍ አሁን ያለውን የግዢ ዋጋ ይጠቀማል።', From: 'ከ', To: 'እስከ', 'Daily sales': 'ዕለታዊ ሽያጭ', 'By payment method': 'በክፍያ ዘዴ', 'Product performance': 'የምርት አፈጻጸም', 'Export CSV': 'CSV አውርድ', 'Expiring stock': 'ጊዜው የሚያበቃ ክምችት', 'Nothing is expiring in this window.': 'በዚህ ጊዜ ውስጥ ጊዜው የሚያበቃ ክምችት የለም።', Expired: 'ጊዜው አልፏል', 'Gross profit': 'ጠቅላላ ትርፍ', 'Cost of goods': 'የዕቃ ወጪ', 'Transactions': 'ግብይቶች', 'Units sold': 'የተሸጡ ክፍሎች',
  'Administration': 'አስተዳደር', 'Who changed prices, stock, sales and accounts.': 'ዋጋ፣ ክምችት፣ ሽያጭ እና መለያዎችን ማን እንደቀየረ።', 'All records': 'ሁሉም መዝገቦች', When: 'መቼ', Who: 'ማን', Action: 'ተግባር', Details: 'ዝርዝር', 'No activity recorded yet.': 'እስካሁን ምንም እንቅስቃሴ አልተመዘገበም።', Previous: 'ቀዳሚ', Next: 'ቀጣይ',
  'Inventory control': 'የክምችት ቁጥጥር', 'Reorder low-stock items and receive supplier deliveries.': 'ክምችታቸው ዝቅ ያሉ ዕቃዎችን ይዘዙ፤ ከአቅራቢ የመጡ ዕቃዎችን ይቀበሉ።', 'Reorder suggestions': 'የድጋሚ ትዕዛዝ ምክሮች', 'Purchase orders': 'የግዢ ትዕዛዞች', 'Select supplier': 'አቅራቢ ይምረጡ', 'Create purchase order': 'የግዢ ትዕዛዝ ፍጠር', 'Mark ordered': 'እንደታዘዘ ምልክት አድርግ', 'Receive stock': 'ክምችት ተቀበል', Cancel: 'ሰርዝ', 'All products are above their reorder level.': 'ሁሉም ምርቶች ከድጋሚ ትዕዛዝ ደረጃቸው በላይ ናቸው።',
  'Stock movements': 'የክምችት እንቅስቃሴዎች', 'Record supplier receipts and loss adjustments.': 'ከአቅራቢ የተቀበሉ ዕቃዎችን እና የኪሳራ ማስተካከያዎችን ይመዝግቡ።', 'Shipment details': 'የመላኪያ ዝርዝሮች', 'Supplier and delivery reference for this receipt.': 'ለዚህ ደረሰኝ አቅራቢ እና የመላኪያ ማጣቀሻ።', 'Add supplier': 'አቅራቢ ጨምር', 'Lot no.': 'የሎት ቁጥር', 'Expiry date': 'የማብቂያ ቀን', 'Reason for loss': 'የኪሳራ ምክንያት', Reference: 'ማጣቀሻ', Receipt: 'ዕቃ መቀበያ', Loss: 'ኪሳራ',
  'Full name': 'ሙሉ ስም', 'Account details': 'የመለያ ዝርዝሮች', 'Change password': 'የይለፍ ቃል ቀይር', 'Current password': 'የአሁኑ የይለፍ ቃል', 'New password': 'አዲስ የይለፍ ቃል', 'Confirm new password': 'አዲሱን የይለፍ ቃል ያረጋግጡ', 'Save changes': 'ለውጦችን አስቀምጥ',
  Cash: 'ጥሬ ገንዘብ', Card: 'ካርድ', 'CBE Birr': 'CBE ብር', 'Open a shift before recording sales.': 'ሽያጭ ከመመዝገብዎ በፊት ፈረቃ ይክፈቱ።', 'Sale completed': 'ሽያጩ ተጠናቋል', 'Low stock': 'ክምችት ዝቅተኛ ነው', 'Loading account…': 'መለያ በመጫን ላይ…',
  'Retail operations': 'የችርቻሮ ሥራዎች', 'Live report': 'ቀጥታ ሪፖርት', 'Daily performance and stock position at a glance.': 'የዕለቱን አፈጻጸም እና የክምችት ሁኔታ በአንድ እይታ።', Today: 'ዛሬ', 'Sales today': 'የዛሬ ሽያጭ', 'Ethiopia time': 'የኢትዮጵያ ሰዓት', 'Sales recorded today': 'ዛሬ የተመዘገቡ ሽያጮች', 'Packaged items today': 'ዛሬ የተሸጡ የታሸጉ ዕቃዎች', 'At or below reorder level': 'ከድጋሚ ትዕዛዝ ደረጃ ጋር እኩል ወይም ከዚያ በታች', 'Review stock': 'ክምችትን ይመልከቱ', 'All clear': 'ሁሉም ደህና ነው', 'Sales performance': 'የሽያጭ አፈጻጸም', 'Retail sales · last 7 days': 'የችርቻሮ ሽያጭ · ያለፉት 7 ቀናት', 'Reorder watch': 'የድጋሚ ትዕዛዝ ክትትል', 'Items at or below minimum': 'በዝቅተኛ ደረጃ ወይም ከዚያ በታች ያሉ ዕቃዎች', 'View inventory': 'ክምችትን ይመልከቱ', 'Inventory snapshot': 'የክምችት አጠቃላይ እይታ', 'Current packaged retail stock': 'የአሁኑ የችርቻሮ ክምችት', 'Search name or SKU': 'በስም ወይም SKU ፈልግ', 'Top sellers': 'በብዛት የተሸጡ', 'Units sold today': 'ዛሬ የተሸጡ ክፍሎች',
  'Store catalog': 'የመደብር ምርቶች', 'Add product': 'ምርት ጨምር', 'Search SKU, name, or brand': 'SKU፣ ስም ወይም ብራንድ ፈልግ', 'Filter by category': 'በምድብ አጣራ', 'All categories': 'ሁሉም ምድቦች', 'Selling price': 'የሽያጭ ዋጋ', 'On hand': 'በክምችት ያለ', 'Reorder at': 'ድጋሚ ትዕዛዝ ደረጃ', 'Edit product': 'ምርት አርትዕ', 'Create product': 'ምርት ፍጠር', 'Product name': 'የምርት ስም', Brand: 'ብራንድ', Category: 'ምድብ', 'Package size': 'የጥቅል መጠን', 'Reorder level': 'የድጋሚ ትዕዛዝ ደረጃ', 'Cost price (ETB)': 'የግዢ ዋጋ (ብር)', 'Selling price (ETB)': 'የሽያጭ ዋጋ (ብር)', 'Scan or type barcode': 'ባርኮድ ይቃኙ ወይም ይተይቡ', 'Barcode (optional)': 'ባርኮድ (አማራጭ)', 'Catalog details and ETB prices': 'የምርት ዝርዝሮች እና ዋጋዎች', 'New products start at zero stock. Receive opening stock as a separate audited stock-in entry.': 'አዲስ ምርቶች ከዜሮ ክምችት ይጀምራሉ። የመጀመሪያ ክምችትን በተለየ የኦዲት መዝገብ ያስገቡ።',
  'Shift open': 'ፈረቃ ተከፍቷል', 'Opened by': 'የከፈተው', 'Opening inventory will be snapshotted.': 'የመክፈቻ ክምችት ቅጂ ይያዛል።', 'Physical counts must include every active product.': 'ትክክለኛ ቆጠራ እያንዳንዱን ንቁ ምርት ማካተት አለበት።', 'Variance is saved for audit': 'ልዩነቱ ለኦዲት ይመዘገባል', 'Cash counted (ETB)': 'የተቆጠረ ገንዘብ (ብር)',
  'Current stock is checked before every sale.': 'ከእያንዳንዱ ሽያጭ በፊት ክምችት ይፈተሻል።', 'Select product': 'ምርት ይምረጡ', 'in stock': 'በክምችት አለ', 'No matching products.': 'የሚዛመድ ምርት አልተገኘም።', 'Open shift before recording sales.': 'ሽያጭ ከመመዝገብዎ በፊት ፈረቃ ይክፈቱ።', 'Out of stock': 'ክምችት አልቋል',
  'Set the date range to see sales, cost and profit.': 'ሽያጭ፣ ወጪ እና ትርፍ ለማየት የቀን ክልል ይምረጡ።', 'Next 30 days': 'ቀጣዮቹ 30 ቀናት', 'Next 60 days': 'ቀጣዮቹ 60 ቀናት', 'Next 90 days': 'ቀጣዮቹ 90 ቀናት', 'Next 180 days': 'ቀጣዮቹ 180 ቀናት', 'Order': 'ትዕዛዝ', 'In stock': 'በክምችት ያለ', 'Suggested quantity': 'የተጠቆመ ብዛት', 'Unit cost (ETB)': 'የአንዱ ወጪ (ብር)', 'last from': 'የመጨረሻ አቅራቢ', 'No purchase orders yet.': 'እስካሁን የግዢ ትዕዛዝ የለም።',
  'Loading account…': 'መለያ በመጫን ላይ…',
  'Account settings': 'የመለያ ቅንብሮች', 'Update your account details and sign-in password.': 'የመለያ ዝርዝሮችዎን እና የመግቢያ የይለፍ ቃልዎን ያዘምኑ።', 'Your role is managed by an administrator.': 'ሚናዎ በአስተዳዳሪ ይተዳደራል።', 'Leave these fields blank to keep your current password.': 'የአሁኑን የይለፍ ቃል ለመጠበቅ እነዚህን መስኮች ባዶ ይተዉ።', Role: 'ሚና',
  'No shift is open': 'የተከፈተ ፈረቃ የለም', 'Open a till before recording sales. Opening inventory will be snapshotted.': 'ሽያጭ ከመመዝገብ በፊት ገንዘብ ቤቱን ይክፈቱ። የመክፈቻ ክምችት ቅጂ ይያዛል።', 'Opened by': 'የከፈተው', 'Variances are saved for audit': 'ልዩነቶች ለኦዲት ይመዘገባሉ',
  'Point of sale': 'የሽያጭ ቦታ', 'Sales checkout': 'የሽያጭ ማስመዝገቢያ', 'Sales today': 'የዛሬ ሽያጭ', 'Current stock is checked before every sale.': 'ከእያንዳንዱ ሽያጭ በፊት ክምችት ይፈተሻል።', 'Open a till before recording sales.': 'ሽያጭ ከመመዝገብ በፊት ገንዘብ ቤቱን ይክፈቱ።',
  'Forgot password?': 'የይለፍ ቃል ረሱ?', 'Enter the email on your account and we will send a reset link. No email on file? Ask your administrator to reset your password.': 'በመለያዎ ያለውን ኢሜይል ያስገቡ፤ የማደሻ አገናኝ እንልካለን። ኢሜይል ከሌለ አስተዳዳሪዎን የይለፍ ቃሉን እንዲያድስ ይጠይቁ።', Email: 'ኢሜይል', 'Send reset link': 'የማደሻ አገናኝ ላክ', 'Back to sign in': 'ወደ መግቢያ ተመለስ', 'Set a new password': 'አዲስ የይለፍ ቃል ያዘጋጁ', 'Use at least 12 characters. You will be signed out on all devices.': 'ቢያንስ 12 ቁምፊዎችን ይጠቀሙ። ከሁሉም መሣሪያዎች ይወጣሉ።', 'Confirm password': 'የይለፍ ቃሉን ያረጋግጡ', 'Update password': 'የይለፍ ቃሉን አዘምን', 'Email verification': 'የኢሜይል ማረጋገጫ', 'Confirming your email address.': 'የኢሜይል አድራሻዎን በማረጋገጥ ላይ።', 'Confirm email verified. You can now reset your password by email.': 'ኢሜይሉ ተረጋግጧል። አሁን በኢሜይል የይለፍ ቃልዎን ማደስ ይችላሉ።',
  'Record supplier receipts and loss adjustments.': 'ከአቅራቢ የተቀበሉ ዕቃዎችን እና የኪሳራ ማስተካከያዎችን ይመዝግቡ።', 'Signed in as': 'የገቡት እንደ', 'Receive stock': 'ክምችት ተቀበል', 'Record loss': 'ኪሳራ መዝግብ', 'Movement history': 'የእንቅስቃሴ ታሪክ', 'Invoice / delivery reference (optional)': 'የኢንቮይስ / መላኪያ ማጣቀሻ (አማራጭ)', 'Invoice number or delivery note': 'የኢንቮይስ ቁጥር ወይም የመላኪያ ማስታወሻ', Supplier: 'አቅራቢ', Optional: 'አማራጭ', 'Lots received with an expiry date and still in stock.': 'የማብቂያ ቀን ያላቸው እና አሁንም በክምችት ያሉ ሎቶች።', Lot: 'ሎት', left: 'ቀሪ', Expires: 'የሚያበቃው',
  'Products at or below their reorder level. Quantities aim for two weeks of recent sales.': 'በድጋሚ ትዕዛዝ ደረጃ ወይም ከዚያ በታች ያሉ ምርቶች። ብዛቱ የሁለት ሳምንት የቅርብ ሽያጭን ያሰላል።', 'Include': 'አካትት', 'Add every line of this order to stock now?': 'የዚህን ትዕዛዝ ሁሉንም ዕቃዎች አሁን ወደ ክምችት ይጨምሩ?', System: 'ስርዓት', 'Filter by record type': 'በመዝገብ አይነት አጣራ', Page: 'ገጽ', of: 'ከ',
  'Engine oil': 'የሞተር ዘይት', 'Transmission fluid': 'የማርሽ ዘይት', Coolant: 'የሞተር ማቀዝቀዣ', Accessory: 'መለዋወጫ', 'Packaged good': 'የታሸገ ዕቃ', Telebirr: 'ቴሌብር', 'CBE Birr': 'CBE ብር', 'Store manager': 'የመደብር አስተዳዳሪ', Administrator: 'አስተዳዳሪ',
  'User management': 'የተጠቃሚ አስተዳደር', 'Manage station access and account roles.': 'የስቴሽን መግቢያን እና የመለያ ሚናዎችን ያስተዳድሩ።', 'Add user': 'ተጠቃሚ ጨምር', 'Station accounts': 'የስቴሽን መለያዎች', users: 'ተጠቃሚዎች', Account: 'መለያ', Status: 'ሁኔታ', Created: 'የተፈጠረበት', Actions: 'ተግባሮች', You: 'እርስዎ', Inactive: 'የቦዘነ', Edit: 'አርትዕ', 'Saving…': 'በማስቀመጥ ላይ…', Deactivate: 'አቦዝን', Activate: 'አንቃ', 'Edit user': 'ተጠቃሚን አርትዕ', 'Assign a role for station access.': 'ለስቴሽን መግቢያ ሚና ይመድቡ።', Name: 'ስም', 'Email (for password reset)': 'ኢሜይል (ለይለፍ ቃል ማደሻ)', 'Temporary password (minimum 12 characters)': 'ጊዜያዊ የይለፍ ቃል (ቢያንስ 12 ቁምፊዎች)', 'Email verified': 'ኢሜይሉ ተረጋግጧል', 'Not verified: reset links are disabled': 'አልተረጋገጠም፦ የማደሻ አገናኞች አይሰሩም', 'Resend verification': 'ማረጋገጫውን እንደገና ላክ', 'Email (for password reset)': 'ኢሜይል (ለይለፍ ቃል ማደሻ)', 'Temporary password (minimum 12 characters)': 'ጊዜያዊ የይለፍ ቃል (ቢያንስ 12 ቁምፊዎች)',
  'This reset link is invalid. Request a new one.': 'ይህ የማደሻ አገናኝ ትክክል አይደለም። አዲስ ይጠይቁ።', 'Passwords do not match.': 'የይለፍ ቃሎቹ አይዛመዱም።', 'This verification link is invalid.': 'ይህ የማረጋገጫ አገናኝ ትክክል አይደለም።', 'Email verified. You can now reset your password by email.': 'ኢሜይሉ ተረጋግጧል። አሁን በኢሜይል የይለፍ ቃልዎን ማደስ ይችላሉ።', 'Verifying…': 'በማረጋገጥ ላይ…', 'If that email belongs to an active account, a reset link has been sent.': 'ያ ኢሜይል ንቁ መለያ ካለው፣ የማደሻ አገናኝ ተልኳል።', 'Password updated. You can sign in now.': 'የይለፍ ቃሉ ተዘምኗል። አሁን መግባት ይችላሉ።',
  'Store operations': 'የመደብር ሥራ', 'start here.': 'እዚህ ይጀምራል።', Online: 'በመስመር ላይ', Offline: 'ከመስመር ውጭ',
}

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (text: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem('inventory-language') === 'am' ? 'am' : 'en'
    } catch {
      return 'en'
    }
  })

  const setLanguage = (next: Language) => {
    setLanguageState(next)
    try { localStorage.setItem('inventory-language', next) } catch { /* Storage may be disabled. */ }
  }

  useEffect(() => {
    document.documentElement.lang = language === 'am' ? 'am' : 'en'
  }, [language])

  const value = { language, setLanguage, t: (text: string) => language === 'am' ? am[text] ?? text : text }
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
