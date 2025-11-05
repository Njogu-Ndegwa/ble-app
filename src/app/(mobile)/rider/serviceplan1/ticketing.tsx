"use client";

import React, { useState, useEffect } from "react";
import {
  HelpCircle,
  MessageCircle,
  Clock,
  User,
  Send,
  X,
  Search,
  Loader2,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { useI18n } from '@/i18n';

// Interfaces
interface Ticket {
  id: number;
  number: string;
  subject: string;
  priority: string; // "1", "2", etc.
  partner_id: number;
  customer: string;
  create_date: string;
}

interface Message {
  id: number;
  body: string;
  author: string;
  create_date: string;
  is_customer: boolean;
}

interface ServicePlan {
  name: string;
  price: number;
  productId: number;
  default_code: string;
  suggested_billing_frequency?: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  partner_id?: number;
}

interface TicketingProps {
  customer: Customer | null;
  allPlans: ServicePlan[];
}

// Priority mapping - using local function to access t() in context
const getPriorityName = (priority: string, t: any): string => {
  switch (priority) {
    case "1":
      return t("Low");
    case "2":
      return t("Medium");
    case "3":
      return t("High");
    case "4":
      return t("Urgent");
    default:
      return t("Medium");
  }
};

// Priority colors
const getPriorityColor = (priority: string, t: any) => {
  const prio = getPriorityName(priority, t);
  // Use French translations for comparison
  const translatedPrio = t(prio);
  if (translatedPrio === t("Urgent") || prio === t("Urgent")) {
    return "bg-red-100 text-red-800 border-red-200";
  } else if (translatedPrio === t("High") || prio === t("High")) {
    return "bg-orange-100 text-orange-800 border-orange-200";
  } else if (translatedPrio === t("Medium") || prio === t("Medium")) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  } else if (translatedPrio === t("Low") || prio === t("Low")) {
    return "bg-gray-100 text-gray-800 border-gray-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
};

const Ticketing: React.FC<TicketingProps> = ({ customer, allPlans }) => {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    priority: "Medium" as const,
    product_id: "",
    subscription_id: "",
  });
  const [comment, setComment] = useState("");

  const API_BASE =
    "https://crm-omnivoltaic.odoo.com/api";
  const API_KEY = "abs_connector_secret_key_2024";
  
  // Get token from localStorage
  const getHeaders = () => {
    const token = localStorage.getItem("authToken_rider");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
    };
    // Add Bearer token if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // Fetch tickets automatically when component mounts or customer.partner_id changes
  useEffect(() => {
    // Try to get partner_id from customer or localStorage
    const partnerId = customer?.partner_id || (() => {
      try {
        const storedCustomer = localStorage.getItem("customerData_rider");
        if (storedCustomer) {
          const parsed = JSON.parse(storedCustomer);
          return parsed?.partner_id;
        }
      } catch (e) {
        console.error("Error parsing stored customer data:", e);
      }
      return null;
    })();

    if (!partnerId) {
      console.log("Ticketing: No partner_id available, skipping fetch. Customer:", customer);
      setIsLoadingTickets(false);
      setTickets([]);
      return;
    }

    console.log("Ticketing: Fetching tickets for partner_id:", partnerId);
    const TICKETS_URL = `${API_BASE}/tickets?partner_id=${partnerId}&page=1&page_size=20`;

    const fetchTickets = async () => {
      setIsLoadingTickets(true);
      try {
        const response = await fetch(TICKETS_URL, {
          method: "GET",
          headers: getHeaders(),
        });
        const data = await response.json();
        console.log("Tickets API Response:", data); // Debug log
        
        if (response.ok) {
          // Handle different response structures
          if (data.success !== false) {
            // Response is successful - extract tickets
            const ticketsList = data.tickets || data.data?.tickets || data.data || [];
            const ticketsArray = Array.isArray(ticketsList) ? ticketsList : [];
            console.log("Ticketing: Fetched tickets:", ticketsArray.length);
            setTickets(ticketsArray);
          } else {
            console.error("API returned success=false:", data);
            setTickets([]);
          }
        } else {
          console.error("API Error:", response.status, data);
          setTickets([]);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        setTickets([]);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchTickets();
  }, [customer?.partner_id, customer?.id]);

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const isFormValid =
    formData.subject.trim() && formData.description.trim() && formData.priority;

  const handleCreateTicket = async () => {
    if (!isFormValid || !customer?.id) return;

    setIsCreatingTicket(true);
    try {
      const ticketData: any = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority.toLowerCase(),
        customer_identity: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      };

      if (formData.product_id) {
        ticketData.product_id = parseInt(formData.product_id);
      }
      if (formData.subscription_id) {
        ticketData.subscription_id = parseInt(formData.subscription_id);
      }

      console.log("Creating ticket with payload:", ticketData); // Debug log

      const response = await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(ticketData),
      });

      const data = await response.json();
      console.log("Create ticket response:", data); // Debug log

      if (response.ok && data.success) {
        setFormData({
          subject: "",
          description: "",
          priority: "Medium",
          product_id: "",
          subscription_id: "",
        });
        setShowNewTicketForm(false);
        // Refetch tickets after creation
        const partnerId = customer?.partner_id || (() => {
          try {
            const storedCustomer = localStorage.getItem("customerData_rider");
            if (storedCustomer) {
              const parsed = JSON.parse(storedCustomer);
              return parsed?.partner_id;
            }
          } catch (e) {
            return null;
          }
          return null;
        })();
        
        if (partnerId) {
          const refetchUrl = `${API_BASE}/tickets?partner_id=${partnerId}`;
          const fetchResponse = await fetch(refetchUrl, { headers: getHeaders() });
          const fetchData = await fetchResponse.json();
          if (fetchResponse.ok && fetchData.success) {
            setTickets(fetchData.tickets || []);
          }
        }
      } else {
        console.error("Ticket creation failed:", data);
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const handleViewTicket = async (ticketId: number) => {
    try {
      // Fetch ticket details if needed; for now, use available data
      setSelectedTicket(tickets.find((t) => t.id === ticketId) || null);
      setShowDetails(true);
    } catch (error) {
      console.error("Error fetching ticket details:", error);
    }
  };

  const filteredTickets = tickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingTickets) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // New Ticket Form View
  if (showNewTicketForm) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-white">{t('New Ticket')}</h2>
              </div>
              <button
                onClick={() => setShowNewTicketForm(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Subject *')}
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleFormChange}
                  placeholder={t('Enter ticket subject')}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Description *')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder={t('Describe your issue...')}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Priority *')}
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('Select Priority')}</option>
                  <option value="Low">{t('Low')}</option>
                  <option value="Medium">{t('Medium')}</option>
                  <option value="High">{t('High')}</option>
                  <option value="Urgent">{t('Urgent')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Product (Optional)')}
                </label>
                <select
                  name="product_id"
                  value={formData.product_id}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('Select Product')}</option>
                  {allPlans.map((plan) => (
                    <option key={plan.productId} value={plan.productId}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('Subscription (Optional)')}
                </label>
                <select
                  name="subscription_id"
                  value={formData.subscription_id}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('None')}</option>
                  <option value="1">{t('Basic Plan')}</option>
                  <option value="2">{t('Premium Plan')}</option>
                </select>
              </div>

              <button
                onClick={handleCreateTicket}
                disabled={!isFormValid || isCreatingTicket}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
              >
                {isCreatingTicket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('Creating...')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('Submit Ticket')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ticket Details View
  if (showDetails && selectedTicket) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 space-y-4">
            <button
              onClick={() => {
                setShowDetails(false);
                setSelectedTicket(null);
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('Back to Tickets')}
            </button>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {t('Ticket #')}{selectedTicket.number}: {selectedTicket.subject}
                </h3>
                <p className="text-gray-400 text-sm">
                  {t('Customer:')} {selectedTicket.customer}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                    selectedTicket.priority,
                    t
                  )}`}
                >
                  {getPriorityName(selectedTicket.priority, t)}
                </span>
              </div>

              <div className="text-sm text-gray-400 space-y-1">
                <p>
                  {t('Created:')}{" "}
                  {new Date(selectedTicket.create_date).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">
                  {t('Timeline')}
                </h4>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">{t('No messages yet.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Tickets List View
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#24272C] to-[#0C0C0E] p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-white">{t('My Tickets')}</h2>
            </div>
            <button
              onClick={() => setShowNewTicketForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('New Ticket')}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search tickets...')}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => handleViewTicket(ticket.id)}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors duration-200"
                >
                  <div className="space-y-3">
                    {/* Header with ticket number and priority */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold text-white text-base">
                          {ticket.number}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getPriorityColor(
                          ticket.priority,
                          t
                        )}`}
                      >
                        {getPriorityName(ticket.priority, t)}
                      </span>
                    </div>

                    {/* Subject */}
                    <div>
                      <h3 className="text-sm font-medium text-white line-clamp-2 leading-relaxed">
                        {ticket.subject}
                      </h3>
                    </div>

                    {/* Footer with metadata */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-600">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(ticket.create_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{t('No tickets found.')}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {t('Create your first ticket to get started.')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ticketing;
