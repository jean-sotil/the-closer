import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  Save,
  AlertCircle,
  Check,
  ChevronDown,
} from "lucide-react";

// Template variable types
const TEMPLATE_VARIABLES = [
  { key: "{{business_name}}", label: "Business Name", example: "Joe's Plumbing" },
  { key: "{{contact_name}}", label: "Contact Name", example: "John Smith" },
  { key: "{{city}}", label: "City", example: "Austin" },
  { key: "{{load_time}}", label: "Load Time", example: "6.2 seconds" },
  { key: "{{performance_score}}", label: "Performance Score", example: "32/100" },
  { key: "{{evidence_link}}", label: "Evidence Link", example: "https://..." },
  { key: "{{calendar_link}}", label: "Calendar Link", example: "https://cal.com/..." },
  { key: "{{your_name}}", label: "Your Name", example: "Sarah Johnson" },
  { key: "{{your_company}}", label: "Your Company", example: "WebFix Pro" },
] as const;

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateEditorProps {
  templates?: EmailTemplate[];
  onSave?: (template: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt">) => void;
  onDelete?: (id: string) => void;
}

// Sample data for preview
const SAMPLE_DATA: Record<string, string> = {
  "{{business_name}}": "Joe's Plumbing",
  "{{contact_name}}": "John Smith",
  "{{city}}": "Austin",
  "{{load_time}}": "6.2 seconds",
  "{{performance_score}}": "32/100",
  "{{evidence_link}}": "https://evidence.thecloser.ai/abc123",
  "{{calendar_link}}": "https://cal.com/book/yourname",
  "{{your_name}}": "Sarah Johnson",
  "{{your_company}}": "WebFix Pro",
};

// Default templates
const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "1",
    name: "Initial Outreach",
    subject: "Quick question about {{business_name}}'s website",
    body: `Hi {{contact_name}},

I noticed that {{business_name}}'s website takes {{load_time}} to load on mobile devices. This is likely costing you customers - studies show 53% of visitors leave if a page takes more than 3 seconds to load.

Here's a quick video showing the issue: {{evidence_link}}

I've helped similar businesses in {{city}} improve their load times by 70%+ in under a week.

Would you be open to a 15-minute call to discuss? You can book a time here: {{calendar_link}}

Best,
{{your_name}}
{{your_company}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Follow-up #1",
    subject: "Re: {{business_name}} website performance",
    body: `Hi {{contact_name}},

Following up on my earlier email about {{business_name}}'s website.

Did you get a chance to watch the video? Your site's current performance score is {{performance_score}}, which puts it in the bottom 20% of websites.

I have a few slots open this week if you'd like to chat: {{calendar_link}}

Best,
{{your_name}}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function replaceVariables(text: string, data: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.split(key).join(value);
  }
  return result;
}

function validateTemplate(template: { subject: string; body: string }): string[] {
  const errors: string[] = [];

  if (!template.subject.trim()) {
    errors.push("Subject line is required");
  }

  if (!template.body.trim()) {
    errors.push("Email body is required");
  }

  if (template.subject.length > 100) {
    errors.push("Subject line should be under 100 characters");
  }

  // Check for unsubscribe link requirement
  if (!template.body.toLowerCase().includes("unsubscribe")) {
    errors.push("Email should include an unsubscribe option for CAN-SPAM compliance");
  }

  return errors;
}

export function TemplateEditor({
  templates: propTemplates,
  onSave,
  onDelete,
}: TemplateEditorProps): React.ReactElement {
  const [templates, setTemplates] = useState<EmailTemplate[]>(
    propTemplates ?? DEFAULT_TEMPLATES
  );
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const [editForm, setEditForm] = useState({
    name: selectedTemplate?.name ?? "",
    subject: selectedTemplate?.subject ?? "",
    body: selectedTemplate?.body ?? "",
    isDefault: selectedTemplate?.isDefault ?? false,
  });

  const errors = validateTemplate(editForm);

  // Update form when selection changes
  const handleSelectTemplate = useCallback((id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template) {
      setSelectedId(id);
      setEditForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        isDefault: template.isDefault,
      });
      setIsPreviewMode(false);
    }
  }, [templates]);

  const handleCreateNew = useCallback(() => {
    const newTemplate: EmailTemplate = {
      id: `new-${Date.now()}`,
      name: "New Template",
      subject: "",
      body: "",
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, newTemplate]);
    handleSelectTemplate(newTemplate.id);
  }, [handleSelectTemplate]);

  const handleDelete = useCallback((id: string) => {
    if (templates.length <= 1) {
      return; // Keep at least one template
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    onDelete?.(id);
    // Select first remaining template
    const remaining = templates.filter((t) => t.id !== id);
    if (remaining[0]) {
      handleSelectTemplate(remaining[0].id);
    }
  }, [templates, onDelete, handleSelectTemplate]);

  const handleDuplicate = useCallback((id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template) {
      const duplicated: EmailTemplate = {
        ...template,
        id: `dup-${Date.now()}`,
        name: `${template.name} (Copy)`,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplates((prev) => [...prev, duplicated]);
      handleSelectTemplate(duplicated.id);
    }
  }, [templates, handleSelectTemplate]);

  const handleSave = useCallback(async () => {
    if (errors.length > 0) return;

    setIsSaving(true);
    try {
      // Update local state
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                ...editForm,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );

      // Call external save handler
      onSave?.({
        name: editForm.name,
        subject: editForm.subject,
        body: editForm.body,
        isDefault: editForm.isDefault,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [selectedId, editForm, errors, onSave]);

  const insertVariable = useCallback((variable: string) => {
    setEditForm((prev) => ({
      ...prev,
      body: prev.body + variable,
    }));
    setShowVariablePicker(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
          <p className="text-sm text-gray-500">
            Create and manage email templates for your outreach campaigns
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Template List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Saved Templates</h3>
          <div className="space-y-1">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`group flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  selectedId === template.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <button
                  onClick={() => handleSelectTemplate(template.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500">
                    {template.isDefault ? "Default template" : "Custom template"}
                  </div>
                </button>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleDuplicate(template.id)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {!template.isDefault && templates.length > 1 && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor / Preview */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTemplate && (
            <>
              {/* Toggle */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPreviewMode(false)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      !isPreviewMode
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setIsPreviewMode(true)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      isPreviewMode
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving || errors.length > 0}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    saveSuccess
                      ? "bg-green-600 text-white"
                      : errors.length > 0
                      ? "cursor-not-allowed bg-gray-300 text-gray-500"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Template
                    </>
                  )}
                </button>
              </div>

              {!isPreviewMode ? (
                /* Editor Mode */
                <div className="space-y-4">
                  {/* Template Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., Initial Outreach"
                    />
                  </div>

                  {/* Subject Line */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={editForm.subject}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, subject: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., Quick question about {{business_name}}'s website"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {editForm.subject.length}/100 characters
                    </p>
                  </div>

                  {/* Variable Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setShowVariablePicker(!showVariablePicker)}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Insert Variable
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {showVariablePicker && (
                      <div className="absolute z-10 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
                        <div className="max-h-60 overflow-y-auto p-2">
                          {TEMPLATE_VARIABLES.map((variable) => (
                            <button
                              key={variable.key}
                              onClick={() => insertVariable(variable.key)}
                              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-gray-100"
                            >
                              <div>
                                <div className="font-medium text-gray-900">
                                  {variable.label}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {variable.key}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                e.g., {variable.example}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email Body
                    </label>
                    <textarea
                      value={editForm.body}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, body: e.target.value }))
                      }
                      rows={12}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Write your email content here..."
                    />
                  </div>

                  {/* Validation Errors */}
                  {errors.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="text-sm font-medium text-amber-800">
                            Template Issues
                          </h4>
                          <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
                            {errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Preview Mode */
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-white">
                    {/* Email Header Preview */}
                    <div className="border-b border-gray-200 p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex">
                          <span className="w-16 text-gray-500">From:</span>
                          <span className="text-gray-900">
                            {SAMPLE_DATA["{{your_name}}"]} &lt;you@company.com&gt;
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-16 text-gray-500">To:</span>
                          <span className="text-gray-900">
                            {SAMPLE_DATA["{{contact_name}}"]} &lt;contact@business.com&gt;
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-16 text-gray-500">Subject:</span>
                          <span className="font-medium text-gray-900">
                            {replaceVariables(editForm.subject, SAMPLE_DATA)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Email Body Preview */}
                    <div className="p-4">
                      <div className="whitespace-pre-wrap text-sm text-gray-700">
                        {replaceVariables(editForm.body, SAMPLE_DATA)}
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-500">
                    Preview using sample data. Actual values will be filled from lead profiles.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
