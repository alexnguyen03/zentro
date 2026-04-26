Nếu bạn muốn **dùng SignPath để ký code tự động trong build pipeline**, thì trang bạn gửi (SignPath docs) chính là phần hướng dẫn tích hợp CI/CD. Mình tóm lại cách dùng thực tế để bạn triển khai nhanh.

---

# 1. Kiến trúc tổng thể của SignPath trong build pipeline

Flow chuẩn:

```
CI Build (GitHub / Jenkins / etc)
        │
        │ build artifact (.exe / .dll / .msi / jar / container)
        ▼
Submit signing request → SignPath API
        │
        │ SignPath ký bằng certificate trên HSM
        ▼
Download signed artifact
        │
        ▼
Publish / Release
```

SignPath giữ **private key trong HSM**, build system chỉ gửi artifact để ký. ([SignPath Foundation][1])

---

# 2. Các cách integrate SignPath

Có 3 cách chính:

### 1️⃣ PowerShell module

Dùng trong Windows build agent.

```
Install-Module SignPath
Submit-SigningRequest
```

Dễ nhất nếu build .NET / Windows.

---

### 2️⃣ REST API (phổ biến nhất)

Gọi HTTP API từ CI pipeline.

Base URL:

```
https://app.signpath.io/api/v1/{organizationId}
```

Auth:

```
Authorization: Bearer API_TOKEN
```

([SignPath.io][2])

---

# 3. Ví dụ workflow bằng REST API

## Bước 1 — Submit artifact

Upload file cần ký:

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
-F "projectSlug=my-project" \
-F "signingPolicySlug=release-signing" \
-F "artifact=@build/app.exe" \
https://app.signpath.io/API/v1/$ORG_ID/SigningRequests/SubmitWithArtifact
```

Response:

```
HTTP 201
Location: .../SigningRequests/{id}
```

([SignPath.io][2])

---

## Bước 2 — Poll trạng thái signing

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
https://app.signpath.io/API/v1/$ORG_ID/SigningRequests/$SIGNING_ID
```

Status có thể là:

```
InProgress
WaitingForApproval
Completed
Failed
```

---

## Bước 3 — Download artifact đã ký

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
-o signed.exe \
https://app.signpath.io/API/v1/$ORG_ID/SigningRequests/$SIGNING_ID/SignedArtifact
```

([SignPath.io][2])

---

# 4. CI systems được support

SignPath hỗ trợ origin verification cho:

* GitHub Actions
* Jenkins
* Azure DevOps
* AppVeyor
* TeamCity ([SignPath.io][2])

Origin verification giúp verify:

```
repo
branch
commit
build url
```

đảm bảo binary được build từ đúng source.

---

# 5. Setup tối thiểu để chạy được

Bạn cần cấu hình trước trong SignPath:

1️⃣ **Project**

```
projectSlug
```

2️⃣ **Signing policy**

```
test-signing
release-signing
```

3️⃣ **Artifact configuration**

file nào cần sign.

4️⃣ **API token**

```
User → My Profile → Generate token
```

([SignPath.io][3])

---

# 6. Ví dụ CI pipeline (GitHub Actions)

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Build
    run: dotnet build

  - name: Submit signing
    run: |
      curl -H "Authorization: Bearer $SIGNPATH_TOKEN" \
      -F "projectSlug=my-project" \
      -F "signingPolicySlug=release-signing" \
      -F "artifact=@bin/app.exe" \
      https://app.signpath.io/API/v1/$ORG_ID/SigningRequests/SubmitWithArtifact
```

---

# 7. Tip thực tế khi dùng SignPath

Nên:

* tạo **CI user riêng**
* dùng **test certificate** cho dev build
* chỉ **release certificate cho release pipeline**

SignPath cho phép enforce policy rất chặt.

---

Base URL and authentication
SignPath uses bearer authentication.

Common API arguments	Value
Base URL	https://app.signpath.io/api/v1/$(OrganizationId)
Authorization HTTP header	Authorization: Bearer $(token)
You need to provide these values for every single API request.

Submit a signing request
Synopsis	 
URL	/SigningRequests/SubmitWithArtifact
Method	POST
Encoding	multipart/form-data
Field name	Description
projectSlug	The project for which you want to create the signing request
signingPolicySlug	Signing policy for which you want to create the signing request
artifactConfigurationSlug	Optional: artifact configuration to use for the signing request (default if not specified)
artifact	Artifact file
description	Optional: description for your signing request (e.g. version number)
Example:

curl -H "Authorization: Bearer $API_TOKEN" \
     -F "projectSlug=$PROJECT" \
     -F "signingPolicySlug=test-signing" \
     -F "artifactConfigurationSlug=v2.4" \
     -F "artifact=@$PATH_TO_ARTIFACT" \
     -F "description=$DESCRIPTION" \
     https://app.signpath.io/API/v1/$ORGANIZATION_ID/SigningRequests/SubmitWithArtifact
Success result: HTTP status code 201. A HTTP Location response-header field is returned with the URL of the created entity.

Get signing request data
Synopsis	 
URL	/SigningRequests/$(SigningRequestId)
(Location response-header from the call that submitted the signing request)
Method	GET
Parameters	none
Example:

curl -H "Authorization: Bearer $API_TOKEN" \
     https://app.signpath.io/API/v1/$ORGANIZATION_ID/SigningRequests/$SIGNING_REQUEST_ID
Success result: HTTP status code 200. Signing request data in JSON format:

{
  "status":"Completed",
  "isFinalStatus":true,
  "workflowStatus":"Completed",
  "description":"Called by cURL",
  "projectId":"c90eb2c7-d34e-49fc-9e90-c00235ecaf1a",
  "projectSlug":"test-project",
  "projectName":"Test project",
  "artifactConfigurationId":"24b767a6-092f-4104-869d-25f0da159576",
  "artifactConfigurationSlug":"Default",
  "artifactConfigurationName":"Default",
  "signingPolicyId":"137ada35-fc11-4719-a3a4-269983692197",
  "signingPolicySlug":"test-signing",
  "signingPolicyName":"test-signing",
  "unsignedArtifactLink":"https://app.signpath.io/API/v1/c2099ac1-b4b5-4b30-934e-3933c2d9922d/SigningRequests/a4559e13-9e95-480a-9567-5b8a3252bb27/UnsignedArtifact",
  "signedArtifactLink":"https://app.signpath.io1/API/v1/c2099ac1-b4b5-4b30-934e-3933c2d9922d/SigningRequests/a4559e13-9e95-480a-9567-5b8a3252bb27/SignedArtifact",
  "origin": {
    "buildData": {
      "buildSettingsFile": {
        "downloadLink": "https://app.signpath.io/API/v1/c2099ac1-b4b5-4b30-934e-3933c2d9922d/SigningRequests//a4559e13-9e95-480a-9567-5b8a3252bb27/BuildSettingsFile",
        "fileName": "AppVeyorSettings.json"
      },
      "url": "https://ci.appveyor.com/project/TestUser/Test-Project/builds/12345678/job/03rba4p8tlr2t4f7"
    },
    "repositoryData": {
      "url": "https://github.com/name/project",
      "branchName": "main",
      "commitId": "efe8bbc00c5484bfd38ce13a749ea2103a8ea713",
      "sourceControlManagementType": "git"
    }
  },
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
Available status values: InProgress, WaitingForApproval, Completed, Failed, Denied, Canceled
Available workflowStatus values: Submitted, RetrievingArtifact, WaitingForApproval, QueuedForMalwareScanning, ScanningForMalware, QueuedForProcessing, Processing, Completed, ProcessingFailed, MalwareScanFailed, MalwareDetected, ArtifactRetrievalFailed, Denied, Canceled
origin is only available for signing requests with origin verification
Download the signed artifact
Once the signing request is successfully completed, the status response contains a signedArtifactLink field with a link to the signed artifact file. It can easily be retrieved by issuing the following command:

Synopsis	 
URL	/SigningRequests/$(SigningRequestId)/SignedArtifact
(signedArtifactLink field from GET SigningRequests/id)
Method	GET
Parameters	none
Example:

curl -H "Authorization: Bearer $API_TOKEN" \
     -o $LOCAL_PATH_TO_DOWNLOADED_ARTIFACT \
     https://app.signpath.io/API/v1/$ORGANIZATION_ID/SigningRequests/$SIGNING_REQUEST_ID/SignedArtifact
Success result: HTTP status code 200. Returns the binary content of the signed artifact.

Resubmit a signing request
See Resubmit an existing signing request for more information.

Synopsis	 
URL	/SigningRequests/Resubmit
Method	POST
Encoding	multipart/form-data
originalSigningRequestId	ID of the signing request which you want to resubmit
signingPolicySlug	Signing policy for which you want to create the signing request
description	Optional: description for your signing request (e.g. version number)
Example:

curl -H "Authorization: Bearer $API_TOKEN" \
     -F "originalSigningRequestId=$ORIGINAL_SIGNING_REQUEST_ID" \
     -F "signingPolicySlug=release-signing" \
     -F "description=$DESCRIPTION" \
     https://app.signpath.io/API/v1/$ORGANIZATION_ID/SigningRequests/Resubmit
Success result: HTTP status code 201. A HTTP Location response-header field is returned with the URL of the created entity.