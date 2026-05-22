  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USER);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("gvvr_theme") as "dark" | "light") || "dark",
  );
  
  // Dynamic Catalog State
  const [catalog, setCatalog] = useState<CatalogData>({
    carModels: {}, // Will be populated from API
    carTrims: [],
    carColors: [],
  });
  const [isSyncingWiki, setIsSyncingWiki] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

  const initialView = (window.location.hash.replace("#", "") as any) || "home";
  const [view, setView] = useState<
    "home" | "intro" | "garage" | "admin" | "profile" | "apply"
  >(
    ["home", "intro", "garage", "admin", "profile", "apply"].includes(
      initialView,
    )
      ? initialView
      : "home",
  );

  useEffect(() => {
    window.location.hash = view;
  }, [view]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (
        ["home", "intro", "garage", "admin", "profile", "apply"].includes(hash)
      ) {
        setView(hash as any);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  const [adminTab, setAdminTab] = useState<
    "dashboard" | "vehicles" | "users" | "lookup" | "applications" | "questions"
  >((sessionStorage.getItem("gvvr_adminTab") as any) || "dashboard");
  const setAdminTabPersist = (
    tab:
      | "dashboard"
      | "vehicles"
      | "users"
      | "lookup"
      | "applications"
      | "questions",
  ) => {
    sessionStorage.setItem("gvvr_adminTab", tab);
    setAdminTab(tab);
    setSelectedApplicationId(null);
  };
  const [wikiPreviewUrl, setWikiPreviewUrl] = useState<string | null>(null);
  const [wikiTrims, setWikiTrims] = useState<string[]>([]);
  const [wikiColors, setWikiColors] = useState<string[]>([]);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allSearchVehicles, setAllSearchVehicles] = useState<Vehicle[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState({
    pendingVehicles: 0,
    pendingApps: 0,
    totalPending: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [lookupSort, setLookupSort] = useState("date_desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showBetaAutoFillModal, setShowBetaAutoFillModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [garageTab, setGarageTab] = useState<"car" | "trailer">("car");
  const [garageSearchTerm, setGarageSearchTerm] = useState("");
  const [garageMakerFilter, setGarageMakerFilter] = useState("");
  const [garageViewMode, setGarageViewMode] = useState<"grid" | "list">("grid");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [selectedUserForVehicles, setSelectedUserForVehicles] =
    useState<User | null>(null);
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();

  // Application state
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null);
  const [myApplication, setMyApplication] = useState<any>(null);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [applyAnswers, setApplyAnswers] = useState<Record<string, any>>({});
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [allQuestionsAdmin, setAllQuestionsAdmin] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [formData, setFormData] = useState({
    maker: "",
    model: "",
    year: 2024,
    trim: "",
    color: "",
    plate: "",
    plate_region: "WISCONSIN",
    roblox_username: "",
    image_data: "",
  });

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [trailerSubmitting, setTrailerSubmitting] = useState(false);
  const [trailerFormData, setTrailerFormData] = useState({
    model: "",
    maker: "",
    trailer_type: "",
    color: "",
    plate: "",
    plate_region: "WISCONSIN",
    roblox_username: "",
    image_data: "",
  });

  const handleSubmitTrailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trailerSubmitting) return;
    if (!trailerFormData.model || !trailerFormData.plate) {
      alert("モデル名とナンバープレートは必須です。");
      return;
    }
    setTrailerSubmitting(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trailerFormData,
          year: 2024,
          trim: "",
          owner_id: currentUser.id,
          roblox_username: currentUser.roblox_username,
          vehicle_type: "trailer",
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as any;
        alert(err.error || "登録に失敗しました。");
        return;
      }
      setShowTrailerModal(false);
      setTrailerFormData({
        model: "",
        maker: "",
        trailer_type: "",
        color: "",
        plate: "",
        plate_region: "WISCONSIN",
        roblox_username: "",
        image_data: "",
      });
      await fetchVehicles();
      alert("トレーラー登録申請を送信しました！審査待ちになります。");
    } catch {
      alert("ネットワークエラーが発生しました。");
    } finally {
      setTrailerSubmitting(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gvvr_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!showAddModal || !formData.maker || !formData.model) {
      setWikiPreviewUrl(null);
      setWikiTrims([]);
      setWikiColors([]);
      return;
    }
    const query = `${formData.year} ${formData.maker} ${formData.model}`;
    let cancelled = false;
    setWikiLoading(true);
    setWikiPreviewUrl(null);
    setWikiTrims([]);
    setWikiColors([]);
    fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (cancelled) return;
          if (data?.imageUrl) setWikiPreviewUrl(data.imageUrl);
          if (data?.trims && data.trims.length > 0) setWikiTrims(data.trims);
          else setWikiTrims(catalog.carTrims);
          if (data?.colors && data.colors.length > 0) setWikiColors(data.colors);
          else setWikiColors(catalog.carColors);

      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWikiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.maker, formData.model, formData.year, showAddModal]);

  const fetchVehicles = async () => {
    setIsLoading(true);
    const isAdminView = view === "admin";
    const endpoint = isAdminView
      ? "/api/vehicles?admin=true"
      : `/api/vehicles?userId=${currentUser.id}`;

    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (isAdminView) {
          setAllSearchVehicles(list);
          setVehicles(list.filter((v: Vehicle) => v.status === "pending"));
        } else {
          setVehicles(list);
        }
      }
    } catch (e) {
      console.error("Fetch vehicles failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (view !== "admin") return;
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch users failed:", e);
    }
  };

  const fetchApplication = async () => {
    try {
      const res = await fetch("/api/applications");
      if (res.ok) setMyApplication(await res.json());
    } catch (e) {
      console.error("Fetch application failed:", e);
    }
  };

  const fetchAdminStats = async () => {
    if (currentUser.role !== "admin") return;
    try {
      const res = await fetch("/api/admin-stats");
      if (res.ok) {
        setAdminStats(await res.json());
      }
    } catch (e) {
      console.error("Fetch admin stats failed:", e);
    }
  };

  const fetchAllApplications = async () => {
    try {
      const res = await fetch("/api/applications?admin=true");
      if (res.ok) {
        const data = await res.json();
        setAllApplications(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch all applications failed:", e);
    }
  };

  const fetchQuestions = async (adminMode = false) => {
    try {
      const res = await fetch(
        adminMode ? "/api/questions?admin=true" : "/api/questions",
      );
      if (res.ok) {
        const data = (await res.json()) as any[];
        if (adminMode) setAllQuestionsAdmin(Array.isArray(data) ? data : []);
        else setQuestions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch questions failed:", e);
    }
  };

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user as User);
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLogin();
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (e) {
      console.error("Failed to fetch catalog:", e);
    }
  };

  const handleWikiSync = async () => {
    if (!confirm("Greenville Wikiから最新の車両データを取得し、データベースを更新しますか？\nこの処理には数分かかる場合があります。")) return;
    
    setIsSyncingWiki(true);
    setSyncProgress("Wikiから車両リストを取得中...");

    try {
      const newCatalog = await fetchWikiCatalog(setSyncProgress);
      
      setSyncProgress("データベースに保存中...");
      const success = await saveCatalogToDatabase(newCatalog);

      if (success) {
        setCatalog(newCatalog);
        alert("カタログを正常に更新しました！");
      } else {
        throw new Error("Failed to save to database");
      }
    } catch (e) {
      console.error("Wiki Sync Error:", e);
      alert("同期中にエラーが発生しました。詳細はコンソールを確認してください。");
    } finally {
      setIsSyncingWiki(false);
      setSyncProgress("");
    }
  };



  const handleManualRefresh = () => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    fetchVehicles();
    fetchApplication();
    fetchQuestions();
    if (view === "admin") {
      fetchUsers();
      fetchAllApplications();
      fetchQuestions(true);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    // Clean up shared states to prevent "flashing" old data on view change
    setVehicles([]);
    setAllApplications([]);
    setAllSearchVehicles([]);

    const refreshData = () => {
      fetchVehicles();
      fetchApplication();
      fetchQuestions();
      if (view === "admin" || currentUser.role === "admin") {
        fetchAdminStats();
      }
      if (view === "admin") {
        fetchUsers();
        fetchAllApplications();
        fetchQuestions(true);
      }
    };

    refreshData();

    // 30 Seconds background polling
    const intervalId = setInterval(() => {
      refreshData();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isLoggedIn, view]);

  useEffect(() => {
    if (!showAddModal) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter(
        (item) => item.type.indexOf("image") !== -1,
      );
      if (imageItems.length === 0) return;

      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((f) => f !== null) as File[];

      const existing = parseImages(formData.image_data);
      const newCount = existing.length + files.length;
      if (newCount > 4) {
        alert("画像は最大4枚までです。");
        return;
      }

      try {
        const base64Images = await Promise.all(files.map(compressImage));
        const combined = [...existing, ...base64Images];
        setFormData((prev) => ({
          ...prev,
