import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutlined,
  FilterAltOutlined,
  Inbox,
  NotificationsActive,
  Refresh,
  TrendingUp,
} from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchNotifications } from "../services/notifications";
import { getPriorityNotifications, scoreNotification } from "../utils/priorityInbox";

const notificationTypes = ["All", "Event", "Result", "Placement"];

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(String(timestamp).replace(" ", "T")));
}

function NotificationItem({ notification, viewed, onViewed, priority, index }) {
  const score = Math.round(scoreNotification(notification));

  return (
    <Paper
      elevation={0}
      className={`notification-item ${viewed ? "viewed" : "new"}`}
      component="article"
      style={{ "--item-index": index }}
    >
      <Stack direction="row" alignItems="stretch" spacing={2}>
        <Box className="notification-icon-wrap">
          {priority && <span className="rank-pill">#{index + 1}</span>}
          <Badge color="error" variant="dot" invisible={viewed}>
            <NotificationsActive color={viewed ? "disabled" : "primary"} />
          </Badge>
        </Box>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Chip label={notification.type} size="small" className={`type-${notification.type}`} />
            {priority && (
              <Chip
                label={`Score ${score}`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
            {!viewed && <Chip label="New" size="small" color="error" />}
          </Stack>
          <Typography variant="h6" mt={1} className="notification-title">
            {notification.message}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatTime(notification.timestamp)}
          </Typography>
        </Box>
        <Button
          startIcon={<CheckCircleOutlined />}
          size="small"
          variant={viewed ? "text" : "outlined"}
          onClick={() => onViewed(notification.id)}
          className="mark-button"
        >
          {viewed ? "Viewed" : "Mark"}
        </Button>
      </Stack>
    </Paper>
  );
}

function NotificationsApp({ view }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [viewedIds, setViewedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("viewedNotificationIds") || "[]"));
    } catch {
      return new Set();
    }
  });
  const [type, setType] = useState("All");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [token, setToken] = useState(
    () => localStorage.getItem("notificationApiToken") || ""
  );
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchNotifications({
        limit,
        page,
        type: type === "All" ? "" : type,
      });
      setNotifications(data);
      setStatus("ready");
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStatus("error");
    }
  }, [limit, page, type]);

  useEffect(() => {
    queueMicrotask(loadNotifications);
  }, [loadNotifications]);

  useEffect(() => {
    localStorage.setItem("viewedNotificationIds", JSON.stringify([...viewedIds]));
  }, [viewedIds]);

  useEffect(() => {
    if (token.trim()) {
      localStorage.setItem("notificationApiToken", token.trim());
    } else {
      localStorage.removeItem("notificationApiToken");
    }
  }, [token]);

  const displayedNotifications = useMemo(() => {
    if (view === "priority") {
      return getPriorityNotifications(notifications, limit);
    }

    return notifications;
  }, [notifications, view, limit]);

  const newCount = notifications.filter((item) => !viewedIds.has(item.id)).length;
  const placementCount = notifications.filter((item) => item.type === "Placement").length;
  const resultCount = notifications.filter((item) => item.type === "Result").length;
  const eventCount = notifications.filter((item) => item.type === "Event").length;

  const markViewed = (id) => {
    setViewedIds((current) => new Set([...current, id]));
  };

  return (
    <Box className="app-shell">
      <AppBar position="sticky" color="inherit" elevation={0} className="topbar">
        <Toolbar>
          <Stack direction="row" spacing={1.5} alignItems="center" flexGrow={1}>
            <Box className="brand-mark">
              <Inbox color="primary" />
            </Box>
            <Box>
              <Typography variant="h6">Student Notifications</Typography>
              <Typography variant="caption" color="text.secondary">
                AffordMed evaluation dashboard
              </Typography>
            </Box>
          </Stack>
          <Button startIcon={<Refresh />} onClick={loadNotifications}>
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="content">
        <Box className="hero-band">
          <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="overline" color="primary">
                Campus inbox
              </Typography>
              <Typography variant="h3">Priority-first notification center</Typography>
              <Typography color="text.secondary" className="hero-copy">
                Placements, results, and events organized for faster student action.
              </Typography>
            </Box>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip icon={<TrendingUp />} label={`${placementCount} placements`} color="success" />
              <Chip label={`${resultCount} results`} className="summary-chip warning" />
              <Chip label={`${eventCount} events`} color="primary" variant="outlined" />
            </Stack>
          </Stack>
        </Box>

        <Box className="dashboard-grid">
          <Box>
            <Paper elevation={0} className="control-panel">
              <Stack direction="row" gap={1.5} alignItems="center">
                <Box className="panel-icon">
                  <FilterAltOutlined color="primary" />
                </Box>
                <Box>
                  <Typography variant="overline" color="primary">
                    Controls
                  </Typography>
                  <Typography variant="h4">Notifications</Typography>
                </Box>
              </Stack>

              <Tabs
                value={view}
                onChange={(_, value) => navigate(value === "all" ? "/" : "/priority")}
                className="view-tabs"
              >
                <Tab label="All" value="all" component={Link} to="/" />
                <Tab label="Priority" value="priority" component={Link} to="/priority" />
              </Tabs>

              <Stack spacing={3} mt={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={type}
                    label="Type"
                    onChange={(event) => {
                      setType(event.target.value);
                      setPage(1);
                    }}
                  >
                    {notificationTypes.map((item) => (
                      <MenuItem value={item} key={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="API token"
                  size="small"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  fullWidth
                />

                <Box>
                  <Typography gutterBottom>Limit: {limit}</Typography>
                  <Slider
                    min={5}
                    max={20}
                    step={5}
                    value={limit}
                    marks
                    valueLabelDisplay="auto"
                    onChange={(_, value) => setLimit(value)}
                  />
                </Box>

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={page}
                  onChange={(_, value) => value && setPage(value)}
                  size="small"
                >
                  <ToggleButton value={1}>Page 1</ToggleButton>
                  <ToggleButton value={2}>Page 2</ToggleButton>
                  <ToggleButton value={3}>Page 3</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Paper>
          </Box>

          <Box minWidth={0}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                gap={2}
                className="section-heading"
              >
                <Box>
                  <Typography variant="h5">
                    {view === "priority" ? `Top ${limit} Priority` : "All Notifications"}
                  </Typography>
                  <Typography color="text.secondary">
                    {newCount} new of {notifications.length} loaded
                  </Typography>
                </Box>
                <Chip label={type} color="primary" variant="outlined" />
              </Stack>

              {status === "loading" && (
                <Paper elevation={0} className="empty-state">
                  <Stack alignItems="center" spacing={2}>
                    <CircularProgress />
                    <Box className="loading-lines" />
                  </Stack>
                </Paper>
              )}

              {status === "error" && (
                <Alert severity="error">
                  {error || "Notification service is unavailable."}
                </Alert>
              )}

              {status === "ready" &&
                displayedNotifications.map((notification, index) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    viewed={viewedIds.has(notification.id)}
                    onViewed={markViewed}
                    priority={view === "priority"}
                    index={index}
                  />
                ))}

              {status === "ready" && displayedNotifications.length === 0 && (
                <Paper elevation={0} className="empty-state">
                  <Typography>No notifications found.</Typography>
                </Paper>
              )}
            </Stack>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default NotificationsApp;
