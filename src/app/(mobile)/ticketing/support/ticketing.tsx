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
import { useI18n } from "@/i18n";

// Interfaces
interface Ticket {
  id: number;
  number: string;
  subject: string;
  priority: string; // "low", "medium", etc.
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

// Priority mapping
const getPriorityName = (priority: string, t: any): string => {
  switch (priority.toLowerCase()) {
    case "low":
      return t("Low");
    case "medium":
      return t("Medium");
    case "high":
      return t("High");
    case "urgent":
      return t("Urgent");
    default:
      return t("Medium");
  }
};

// Priority colors
const getPriorityColor = (priority: string, t: any) => {
  const prio = getPriorityName(priority, t);
  switch (prio) {
    case t("Urgent"):
      return { bg: 'var(--color-error-soft)', text: 'var(--color-error)', border: 'var(--color-error-soft)' };
    case t("High"):
      return { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)', border: 'var(--color-warning-soft)' };
    case t("Medium"):
      return { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)', border: 'var(--color-warning-soft)' };
    case t("Low"):
      return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' };
    default:
      return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' };
  }
};

const Ticketing: React.FC = () => {
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
    priority: "medium",
  });
  const [comment, setComment] = useState("");

  const API_BASE =
    "https://crm-omnivoltaic.odoo.com/api";
  const API_KEY = "abs_connector_secret_key_2024";
  const headers = {
    "Content-Type": "application/json",
    "X-API-KEY": API_KEY,
  };

  // Get client_id from localStorage
  const clientId = typeof window !== "undefined" ? localStorage.getItem("distributorId") || "" : "";
  const TICKETS_URL = `${API_BASE}/tickets?client_id=${clientId}&page=1&page_size=20`;

  // Fetch tickets
  useEffect(() => {
    if (!clientId) {
      setIsLoadingTickets(false);
      setTickets([]);
      return;
    }

    const fetchTickets = async () => {
      setIsLoadingTickets(true);
      try {
        const response = await fetch(TICKETS_URL, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        console.log("Tickets API Response:", data); // Debug log
        if (response.ok && data.success) {
          setTickets(data.tickets || []);
        } else {
          console.error("API Error:", data); // Debug log
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
  }, [clientId, TICKETS_URL]);

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
    if (!isFormValid || !clientId) return;

    setIsCreatingTicket(true);
    try {
      const ticketData = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority.toLowerCase(),
        customer_identity: {
          client_id: clientId,
        },
      };

      console.log("Creating ticket with payload:", ticketData); // Debug log

      const response = await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers,
        body: JSON.stringify(ticketData),
      });

      const data = await response.json();
      console.log("Create ticket response:", data); // Debug log

      if (response.ok && data.success) {
        setFormData({
          subject: "",
          description: "",
          priority: "medium",
        });
        setShowNewTicketForm(false);
        // Refetch tickets after creation
        const fetchResponse = await fetch(TICKETS_URL, { headers });
        const fetchData = await fetchResponse.json();
        if (fetchResponse.ok && fetchData.success) {
          setTickets(fetchData.tickets || []);
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
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  // New Ticket Form View
  if (showNewTicketForm) {
    return (
       <div className="min-h-screen p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl p-4 sm:p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t("New Ticket")}</h2>
              </div>
              <button
                onClick={() => setShowNewTicketForm(false)}
                className="transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {t("Subject *")}
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleFormChange}
                  placeholder={t("Enter ticket subject")}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {t("Description *")}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder={t("Describe your issue...")}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {t("Priority *")}
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="">{t("Select Priority")}</option>
                  <option value="low">{t("Low")}</option>
                  <option value="medium">{t("Medium")}</option>
                  <option value="high">{t("High")}</option>
                  <option value="urgent">{t("Urgent")}</option>
                </select>
              </div>

              <button
                onClick={handleCreateTicket}
                disabled={!isFormValid || isCreatingTicket}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
                style={{ opacity: (!isFormValid || isCreatingTicket) ? 0.5 : 1, cursor: (!isFormValid || isCreatingTicket) ? 'not-allowed' : 'pointer' }}
              >
                {isCreatingTicket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("Creating...")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("Submit Ticket")}
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
    const priorityColor = getPriorityColor(selectedTicket.priority, t);
    return (
      <div className="min-h-screen p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl p-4 sm:p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => {
                setShowDetails(false);
                setSelectedTicket(null);
              }}
              className="flex items-center gap-2 transition-colors mb-4"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              {t("Back to Tickets")}
            </button>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t("Ticket #")}{selectedTicket.number}: {selectedTicket.subject}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t("Customer:")} {selectedTicket.customer}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: priorityColor.bg,
                    color: priorityColor.text,
                    border: `1px solid ${priorityColor.border}`,
                  }}
                >
                  {getPriorityName(selectedTicket.priority, t)}
                </span>
              </div>

              <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                <p>
                  {t("Created:")}{" "}
                  {new Date(selectedTicket.create_date).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {t("Timeline")}
                </h4>
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t("No messages yet.")}</p>
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
    <div className="min-h-screen p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl p-4 sm:p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t("My Tickets")}</h2>
            </div>
            <button
              onClick={() => setShowNewTicketForm(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              aria-label={t("New Ticket")}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("Search tickets...")}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const priorityColor = getPriorityColor(ticket.priority, t);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleViewTicket(ticket.id)}
                    className="rounded-lg p-4 cursor-pointer transition-colors duration-200"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-elevated)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div className="space-y-3">
                      {/* Header with ticket number and priority */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                            {ticket.number}
                          </span>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                          style={{
                            background: priorityColor.bg,
                            color: priorityColor.text,
                            border: `1px solid ${priorityColor.border}`,
                          }}
                        >
                          {getPriorityName(ticket.priority, t)}
                        </span>
                      </div>

                      {/* Subject */}
                      <div>
                        <h3 className="text-sm font-medium line-clamp-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {ticket.subject}
                        </h3>
                      </div>

                      {/* Footer with metadata */}
                      <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Clock className="w-3.5 h-3.5" />
                           <span>{new Date(ticket.create_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>{t("No tickets found.")}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t("Create your first ticket to get started.")}
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