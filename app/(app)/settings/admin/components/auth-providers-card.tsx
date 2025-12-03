"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Accordion,
  AccordionItem,
  Input,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast,
} from "@heroui/react";
import {
  KeyIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";
import SecretInput from "@/components/shared/secret-input";

function EnvManagedBadge({ isOverridden }: { isOverridden: boolean | undefined }) {
  if (isOverridden === undefined) return null;

  return isOverridden ? (
    <Chip color="success" size="sm" variant="flat">
      Managed by DB
    </Chip>
  ) : (
    <Chip color="warning" size="sm" variant="flat">
      Managed by env
    </Chip>
  );
}

export default function AuthProvidersCard() {
  const { authProviderOIDC, authProviderGitHub, authProviderGoogle } = useAdminSettingsContext();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Authentication Providers</h2>
          <Chip color="warning" size="sm" variant="flat">
            Requires restart
          </Chip>
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-sm">
          Configure OAuth providers for user authentication. Changes require a server restart to
          take effect.
        </p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="oidc"
            subtitle="Generic OpenID Connect"
            title={
              <div className="flex items-center gap-2">
                <span>OIDC Provider</span>
                {authProviderOIDC && (
                  <EnvManagedBadge isOverridden={authProviderOIDC.isOverridden} />
                )}
              </div>
            }
          >
            <OIDCProviderForm />
          </AccordionItem>
          <AccordionItem
            key="github"
            subtitle="GitHub OAuth"
            title={
              <div className="flex items-center gap-2">
                <span>GitHub</span>
                {authProviderGitHub && (
                  <EnvManagedBadge isOverridden={authProviderGitHub.isOverridden} />
                )}
              </div>
            }
          >
            <GitHubProviderForm />
          </AccordionItem>
          <AccordionItem
            key="google"
            subtitle="Google OAuth"
            title={
              <div className="flex items-center gap-2">
                <span>Google</span>
                {authProviderGoogle && (
                  <EnvManagedBadge isOverridden={authProviderGoogle.isOverridden} />
                )}
              </div>
            }
          >
            <GoogleProviderForm />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}

function OIDCProviderForm() {
  const {
    authProviderOIDC,
    updateAuthProviderOIDC,
    deleteAuthProvider,
    testAuthProvider,
    fetchConfigSecret,
  } = useAdminSettingsContext();

  const [name, setName] = useState(authProviderOIDC?.name ?? "");
  const [issuer, setIssuer] = useState(authProviderOIDC?.issuer ?? "");
  const [clientId, setClientId] = useState(authProviderOIDC?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [wellknown, setWellknown] = useState(authProviderOIDC?.wellknown ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const deleteModal = useDisclosure();

  const isConfigured = !!authProviderOIDC;
  const isSecretConfigured = !!authProviderOIDC?.clientSecret;

  const handleRevealSecret = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AUTH_PROVIDER_OIDC, "clientSecret");
  }, [fetchConfigSecret]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAuthProvider("oidc", {
        name,
        issuer,
        clientId,
        clientSecret: clientSecret || undefined,
        wellknown: wellknown || undefined,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAuthProviderOIDC({
        name,
        issuer,
        clientId,
        clientSecret: clientSecret || undefined,
        wellknown: wellknown || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider("oidc");

    deleteModal.onClose();
    if (!result.success) {
      addToast({
        title: "Cannot delete provider",
        description: result.error,
        color: "danger",
      });

      return;
    }
    // Reset form
    setName("");
    setIssuer("");
    setClientId("");
    setClientSecret("");
    setWellknown("");
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <Input
        label="Provider Name"
        placeholder="e.g., Authentik, Keycloak"
        value={name}
        onValueChange={setName}
      />
      <Input
        label="Issuer URL"
        placeholder="https://your-idp.com"
        value={issuer}
        onValueChange={setIssuer}
      />
      <Input label="Client ID" value={clientId} onValueChange={setClientId} />
      <SecretInput
        isConfigured={isSecretConfigured}
        label="Client Secret"
        placeholder="Enter client secret"
        value={clientSecret}
        onReveal={handleRevealSecret}
        onValueChange={setClientSecret}
      />
      <Input
        label="Well-known URL (optional)"
        placeholder="Auto-derived from issuer if not set"
        value={wellknown}
        onValueChange={setWellknown}
      />

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2 ${
            testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Connection successful
            </>
          ) : (
            <>
              <XMarkIcon className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {isConfigured && (
          <Button
            color="danger"
            startContent={<TrashIcon className="h-4 w-4" />}
            variant="flat"
            onPress={deleteModal.onOpen}
          >
            Remove
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            isLoading={testing}
            startContent={<BeakerIcon className="h-4 w-4" />}
            variant="flat"
            onPress={handleTest}
          >
            Test
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      </div>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            Remove OIDC Provider
          </ModalHeader>
          <ModalBody>
            <p>Are you sure you want to remove this OIDC provider?</p>
            <p className="text-default-500 text-sm">
              Users will no longer be able to sign in using this provider until it is reconfigured.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Remove
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function GitHubProviderForm() {
  const {
    authProviderGitHub,
    updateAuthProviderGitHub,
    deleteAuthProvider,
    testAuthProvider,
    fetchConfigSecret,
  } = useAdminSettingsContext();

  const [clientId, setClientId] = useState(authProviderGitHub?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const deleteModal = useDisclosure();

  const isConfigured = !!authProviderGitHub;
  const isSecretConfigured = !!authProviderGitHub?.clientSecret;

  const handleRevealSecret = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AUTH_PROVIDER_GITHUB, "clientSecret");
  }, [fetchConfigSecret]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAuthProvider("github", {
        clientId,
        clientSecret: clientSecret || undefined,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAuthProviderGitHub({
        clientId,
        clientSecret: clientSecret || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider("github");

    deleteModal.onClose();
    if (!result.success) {
      addToast({
        title: "Cannot delete provider",
        description: result.error,
        color: "danger",
      });

      return;
    }
    setClientId("");
    setClientSecret("");
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <Input label="Client ID" value={clientId} onValueChange={setClientId} />
      <SecretInput
        isConfigured={isSecretConfigured}
        label="Client Secret"
        placeholder="Enter client secret"
        value={clientSecret}
        onReveal={handleRevealSecret}
        onValueChange={setClientSecret}
      />

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2 ${
            testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Client ID format valid
            </>
          ) : (
            <>
              <XMarkIcon className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {isConfigured && (
          <Button
            color="danger"
            startContent={<TrashIcon className="h-4 w-4" />}
            variant="flat"
            onPress={deleteModal.onOpen}
          >
            Remove
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            isLoading={testing}
            startContent={<BeakerIcon className="h-4 w-4" />}
            variant="flat"
            onPress={handleTest}
          >
            Test
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      </div>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            Remove GitHub Provider
          </ModalHeader>
          <ModalBody>
            <p>Are you sure you want to remove the GitHub provider?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Remove
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function GoogleProviderForm() {
  const {
    authProviderGoogle,
    updateAuthProviderGoogle,
    deleteAuthProvider,
    testAuthProvider,
    fetchConfigSecret,
  } = useAdminSettingsContext();

  const [clientId, setClientId] = useState(authProviderGoogle?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [_showSecret, _setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const deleteModal = useDisclosure();

  const isConfigured = !!authProviderGoogle;
  const isSecretConfigured = !!authProviderGoogle?.clientSecret;

  const handleRevealSecret = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, "clientSecret");
  }, [fetchConfigSecret]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAuthProvider("google", {
        clientId,
        clientSecret: clientSecret || undefined,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAuthProviderGoogle({
        clientId,
        clientSecret: clientSecret || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider("google");

    deleteModal.onClose();
    if (!result.success) {
      addToast({
        title: "Cannot delete provider",
        description: result.error,
        color: "danger",
      });

      return;
    }
    setClientId("");
    setClientSecret("");
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <Input
        label="Client ID"
        placeholder="*.apps.googleusercontent.com"
        value={clientId}
        onValueChange={setClientId}
      />
      <SecretInput
        isConfigured={isSecretConfigured}
        label="Client Secret"
        placeholder="Enter client secret"
        value={clientSecret}
        onReveal={handleRevealSecret}
        onValueChange={setClientSecret}
      />

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2 ${
            testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Client ID format valid
            </>
          ) : (
            <>
              <XMarkIcon className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {isConfigured && (
          <Button
            color="danger"
            startContent={<TrashIcon className="h-4 w-4" />}
            variant="flat"
            onPress={deleteModal.onOpen}
          >
            Remove
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            isLoading={testing}
            startContent={<BeakerIcon className="h-4 w-4" />}
            variant="flat"
            onPress={handleTest}
          >
            Test
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      </div>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            Remove Google Provider
          </ModalHeader>
          <ModalBody>
            <p>Are you sure you want to remove the Google provider?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Remove
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
