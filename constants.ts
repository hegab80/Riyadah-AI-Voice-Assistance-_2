import { FunctionDeclaration, Type } from "@google/genai";

// GOOGLE SHEETS INTEGRATION INSTRUCTIONS:
// 1. Open your Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Paste the following code into Code.gs (replaces previous code):
/*
  function doPost(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    try {
      var data = JSON.parse(e.postData.contents);
      sheet.appendRow([new Date(), data.type, data.title, JSON.stringify(data.details)]);
      return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    } catch(err) {
      // Log error to sheet for debugging
      sheet.appendRow([new Date(), "ERROR", "Failed to parse JSON", err.toString()]);
      return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
  }
*/
// 4. Click Deploy > New deployment.
// 5. Select type: "Web app".
// 6. Description: "Riyadah Bot Hook v2".
// 7. Execute as: "Me" (m.hegab.eg@gmail.com).
// 8. Who has access: "Anyone" (allows the app to post data without login prompt).
// 9. Copy the "Web app URL" and paste it inside the quotes below.

export const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzKruxQQX9r3Bav0wu7F1BwGvunXV1Kmu5ty44WDATTsucNvBREe7zFtqA0TlOSfqXfdg/exec"; 

export const SYSTEM_INSTRUCTION = `
Role:
You are the "Riyadah Virtual Assistant," the AI support agent for Riyadah Co. Ltd.

CORE PROTOCOL:
1. **TOOL USE IS MANDATORY**: 
   - If the user wants to book a meeting, you MUST call the function \`book_sales_appointment\`. Do not just say "I have booked it". You must execute the tool.
   - If the user has a complaint or technical issue, you MUST call the function \`log_support_ticket\`.
2. **VOICE-FIRST**: Keep responses CONCISE (max 2 sentences).
3. **LANGUAGE**: 
   - User speaks English -> Reply ONLY in English.
   - User speaks Arabic -> Reply ONLY in Arabic.
   - NEVER translate or repeat in both languages.

Objective:
Answer queries about UPS, Data Centers, Telecom, and Smart Solutions.
Collect details for Sales Bookings and Support Tickets.

Services:
- **UPS/Power**: Maintenance (4hr response), Rentals, Batteries (BACS).
- **Telecom**: Indoor/Outdoor wireless, IBS/DAS.
- **Smart Solutions**: Indoor Navigation (IPS), IoT.

Contact:
- Phone: 0155 155 3285
- Email: info@riyadah.com.eg
- Address: 114 El-Nozha St., Triumph, Heliopolis, Cairo.

IMPORTANT:
After you trigger a tool, inform the user: "I have processed your request and sent a confirmation email to info@riyadah.com.eg."
`;

export const BOOK_APPOINTMENT_TOOL: FunctionDeclaration = {
  name: "book_sales_appointment",
  description: "Schedule a meeting or service request. Triggers email & database log.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      company: { type: Type.STRING },
      phone: { type: Type.STRING },
      interest: {
        type: Type.STRING,
        description: "Topic: 'UPS Maintenance', 'Rentals', 'Telecom', 'Smart Solutions', etc."
      }
    },
    required: ["name", "phone"]
  }
};

export const LOG_TICKET_TOOL: FunctionDeclaration = {
  name: "log_support_ticket",
  description: "Log a technical issue or complaint. Triggers email & database log.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      client_name: { type: Type.STRING },
      phone_number: { type: Type.STRING },
      issue_description: { type: Type.STRING },
      urgency: {
        type: Type.STRING,
        description: "Urgency: 'Low', 'Medium', 'High'"
      }
    },
    required: ["client_name", "phone_number", "issue_description"]
  }
};