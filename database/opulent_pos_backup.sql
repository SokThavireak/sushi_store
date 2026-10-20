--
-- PostgreSQL database dump
--

\restrict bTnDI1dghl1oLLOahOJh8iha1kMMe3hBoczZ3ABLghNbJyWHcmSYRgxlt8amYAN

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cart; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart (
    id integer NOT NULL,
    user_id integer,
    product_id integer,
    quantity integer DEFAULT 1
);


ALTER TABLE public.cart OWNER TO postgres;

--
-- Name: cart_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cart_id_seq OWNER TO postgres;

--
-- Name: cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cart_id_seq OWNED BY public.cart.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: daily_inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_inventory_items (
    id integer NOT NULL,
    log_id integer,
    item_name character varying(255),
    category character varying(100),
    quantity integer,
    unit character varying(50)
);


ALTER TABLE public.daily_inventory_items OWNER TO postgres;

--
-- Name: daily_inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_inventory_items_id_seq OWNER TO postgres;

--
-- Name: daily_inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_inventory_items_id_seq OWNED BY public.daily_inventory_items.id;


--
-- Name: daily_inventory_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_inventory_logs (
    id integer NOT NULL,
    location_name character varying(100),
    user_id integer,
    report_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.daily_inventory_logs OWNER TO postgres;

--
-- Name: daily_inventory_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_inventory_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_inventory_logs_id_seq OWNER TO postgres;

--
-- Name: daily_inventory_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_inventory_logs_id_seq OWNED BY public.daily_inventory_logs.id;


--
-- Name: dashboard_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dashboard_metrics (
    metric_name character varying(50),
    value integer,
    trend_data integer[]
);


ALTER TABLE public.dashboard_metrics OWNER TO postgres;

--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    address text NOT NULL,
    google_map_url text,
    status character varying(20) DEFAULT 'Open'::character varying,
    hours_mon_fri character varying(50),
    hours_sat_sun character varying(50)
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: monthly_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_sales (
    id integer NOT NULL,
    month_name character varying(10),
    revenue integer,
    is_current_month boolean DEFAULT false
);


ALTER TABLE public.monthly_sales OWNER TO postgres;

--
-- Name: monthly_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.monthly_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.monthly_sales_id_seq OWNER TO postgres;

--
-- Name: monthly_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.monthly_sales_id_seq OWNED BY public.monthly_sales.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    quantity integer NOT NULL,
    price numeric NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer,
    total_price numeric NOT NULL,
    payment_method character varying(50) DEFAULT 'Cash'::character varying,
    status character varying(50) DEFAULT 'Pending'::character varying,
    pickup_location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    table_number character varying(50)
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    price numeric(10,2) NOT NULL,
    image_url text,
    category character varying(50),
    is_best_seller boolean DEFAULT false,
    discount_price numeric DEFAULT 0,
    discount_type character varying(20) DEFAULT 'none'::character varying,
    discount_value numeric DEFAULT 0
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: stock_request_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_request_items (
    id integer NOT NULL,
    stock_request_id integer,
    item_name character varying(100),
    category character varying(50),
    quantity integer
);


ALTER TABLE public.stock_request_items OWNER TO postgres;

--
-- Name: stock_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_request_items_id_seq OWNER TO postgres;

--
-- Name: stock_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_request_items_id_seq OWNED BY public.stock_request_items.id;


--
-- Name: stock_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_requests (
    id integer NOT NULL,
    user_id integer,
    location_name character varying(100),
    status character varying(20) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.stock_requests OWNER TO postgres;

--
-- Name: stock_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_requests_id_seq OWNER TO postgres;

--
-- Name: stock_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_requests_id_seq OWNED BY public.stock_requests.id;


--
-- Name: stocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stocks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100),
    quantity integer DEFAULT 0,
    unit character varying(50) DEFAULT 'pcs'::character varying,
    image_url text
);


ALTER TABLE public.stocks OWNER TO postgres;

--
-- Name: stocks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stocks_id_seq OWNER TO postgres;

--
-- Name: stocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stocks_id_seq OWNED BY public.stocks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_location_id integer
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: cart id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart ALTER COLUMN id SET DEFAULT nextval('public.cart_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: daily_inventory_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_inventory_items ALTER COLUMN id SET DEFAULT nextval('public.daily_inventory_items_id_seq'::regclass);


--
-- Name: daily_inventory_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_inventory_logs ALTER COLUMN id SET DEFAULT nextval('public.daily_inventory_logs_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: monthly_sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_sales ALTER COLUMN id SET DEFAULT nextval('public.monthly_sales_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: stock_request_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items ALTER COLUMN id SET DEFAULT nextval('public.stock_request_items_id_seq'::regclass);


--
-- Name: stock_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests ALTER COLUMN id SET DEFAULT nextval('public.stock_requests_id_seq'::regclass);


--
-- Name: stocks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stocks ALTER COLUMN id SET DEFAULT nextval('public.stocks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: cart; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cart (id, user_id, product_id, quantity) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, created_at) FROM stdin;
1	Roll	2025-12-21 00:52:54.420129
2	Set	2025-12-21 00:52:54.420129
3	Sushi	2025-12-21 00:52:54.420129
4	Winter	2025-12-21 00:52:54.420129
5	Hot Roll	2025-12-21 00:52:54.420129
6	Drink	2025-12-21 00:53:38.17256
7	Maki	2025-12-21 01:05:16.473181
8	Ramen	2025-12-21 01:05:16.473181
9	Poke	2025-12-21 01:05:16.473181
12	Most Sales	2025-12-21 01:31:37.229123
\.


--
-- Data for Name: daily_inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_inventory_items (id, log_id, item_name, category, quantity, unit) FROM stdin;
\.


--
-- Data for Name: daily_inventory_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.daily_inventory_logs (id, location_name, user_id, report_date, created_at) FROM stdin;
\.


--
-- Data for Name: dashboard_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dashboard_metrics (metric_name, value, trend_data) FROM stdin;
Total Revenue	5938	{40,60,45,80,55}
Refund Product	82	{30,45,30,60,40,30,50}
Customer Boost	192	{20,35,25,45,30,50}
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, name, address, google_map_url, status, hours_mon_fri, hours_sat_sun) FROM stdin;
1	Downtown Central	1024 Market Street, San Francisco, CA	https://goo.gl/maps/example1	Open	10:00 - 22:00	11:00 - 23:00
2	Westside Plaza	880 West Portal Ave, San Francisco, CA	https://goo.gl/maps/example2	Open	16:00 - 23:00	12:00 - 00:00
\.


--
-- Data for Name: monthly_sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monthly_sales (id, month_name, revenue, is_current_month) FROM stdin;
1	Jan	65	f
2	Feb	59	f
3	Mar	80	t
4	Apr	81	f
5	May	56	f
6	Jun	55	f
7	Jul	40	f
8	Aug	70	f
9	Sep	60	f
10	Oct	75	f
11	Nov	50	f
12	Dec	65	f
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, quantity, price) FROM stdin;
1	1	168	4	7.50
2	1	179	1	22.50
3	1	167	2	6.50
4	2	168	1	7.50
5	2	167	1	6.50
6	3	168	1	7.50
7	3	167	1	6.50
8	4	168	1	7.50
9	4	167	1	6.50
10	5	168	1	7.50
11	5	167	1	6.50
12	6	167	1	6.50
13	7	167	1	6.50
14	8	167	1	6.50
15	9	167	1	6.50
16	10	167	1	6.50
17	11	167	1	6.50
18	12	167	1	6.50
19	13	167	1	6.50
20	14	167	1	6.50
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, user_id, total_price, payment_method, status, pickup_location, created_at, table_number) FROM stdin;
2	4	14	Cash	Cancelled	Downtown Central	2025-12-22 11:19:12.601327	\N
4	4	14	QR	Completed	Downtown Central	2025-12-22 11:55:01.108738	\N
3	4	14	QR	Completed	Downtown Central	2025-12-22 11:22:34.981967	\N
1	4	65.5	QR	Completed	Downtown Central	2025-12-22 11:09:37.303024	\N
5	10	14	Pay at Counter	Completed	Westside Plaza	2025-12-22 15:48:59.85866	
6	4	6.5	QR	Pending	Downtown Central	2025-12-22 17:56:48.742029	\N
7	4	6.5	QR	Pending	Downtown Central	2025-12-23 10:58:15.179276	\N
8	4	6.5	\N	Pending	Downtown Central	2025-12-23 11:03:17.92515	\N
9	4	6.5	\N	Pending	Downtown Central	2025-12-23 11:04:26.650357	\N
10	4	6.5	\N	Pending	Westside Plaza	2025-12-23 11:05:49.331423	\N
11	4	6.5	\N	Pending	Downtown Central	2025-12-23 11:07:17.122054	\N
12	4	6.5	\N	Pending	Downtown Central	2025-12-23 11:07:43.836943	\N
13	11	6.5	\N	Pending	Downtown Central	2025-12-23 11:08:49.545191	\N
14	4	6.5	\N	Pending	Downtown Central	2025-12-23 11:11:11.892971	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, price, image_url, category, is_best_seller, discount_price, discount_type, discount_value) FROM stdin;
168	Spicy Tuna Crunch	7.50	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&roll2	Roll	t	0	none	0
169	Dragon Fire Eel	12.00	https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=400&q=80&roll3	Roll	f	0	none	0
170	Rainbow Bridge Maki	13.50	https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&q=80&roll4	Roll	f	0	none	0
171	Philadelphia Cream	8.00	https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=400&q=80&roll5	Roll	f	0	none	0
172	Salmon Avocado Gold	7.50	https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=400&q=80&roll6	Roll	t	0	none	0
173	Deep Sea Spider	11.00	https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&q=80&roll7	Roll	f	0	none	0
175	Midnight Eel Special	9.50	https://images.unsplash.com/photo-1563612116625-3012372fccce?w=400&q=80&roll9	Roll	f	0	none	0
177	Grand Party Boat	45.00	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&set1	Set	t	0	none	0
178	Executive Bento	18.00	https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&set2	Set	f	0	none	0
179	Salmon Obsession Set	22.50	https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&set3	Set	t	0	none	0
180	Vegetable Garden Combo	15.00	https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400&q=80&set4	Set	f	0	none	0
181	Imperial Sashimi Mix	30.00	https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&q=80&set5	Set	f	0	none	0
182	Quick Lunch Platter	14.00	https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&q=80&set6	Set	t	0	none	0
183	Sushi & Gyoza Box	16.50	https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80&set7	Set	f	0	none	0
184	Late Night Snack Set	13.00	https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&set8	Set	f	0	none	0
185	Chef Omakase Selection	55.00	https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80&set9	Set	t	0	none	0
186	Traditional Nigiri Set	21.00	https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80&set10	Set	f	0	none	0
187	Prime Bluefin Tuna	5.00	https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=80&sushi1	Sushi	t	0	none	0
188	Hamachi Yellowtail	4.50	https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80&sushi2	Sushi	f	0	none	0
190	Smoked Unagi Nigiri	5.50	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&sushi4	Sushi	t	0	none	0
191	Orange Tobiko Nigiri	4.00	https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400&q=80&sushi5	Sushi	f	0	none	0
195	Sweet Egg Omelet	3.00	https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=400&q=80&sushi9	Sushi	f	0	none	0
198	Winter Braised Beef	18.00	https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80&win2	Winter	f	0	none	0
200	Hot Soba Noodle	12.00	https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=400&q=80&win4	Winter	f	0	none	0
202	Creamy Pumpkin Stew	14.00	https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=400&q=80&win6	Winter	t	0	none	0
206	Hot Red Bean Sweet	7.00	https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=400&q=80&win10	Winter	f	0	none	0
208	Dynamite Baked Roll	15.00	https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=400&q=80&hr2	Hot Roll	t	0	none	0
209	Fried Philly Crunch	11.50	https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&q=80&hr3	Hot Roll	t	0	none	0
210	Toasted Eel Special	13.00	https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=400&q=80&hr4	Hot Roll	f	0	none	0
211	Crispy Tempura Lobster	19.50	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&hr5	Hot Roll	f	0	none	0
212	Spicy Baked Crawfish	16.00	https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=400&q=80&hr6	Hot Roll	t	0	none	0
213	Inferno Hot Chicken	12.00	https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&q=80&hr7	Hot Roll	f	0	none	0
215	Toasted Scallop Roll	15.50	https://images.unsplash.com/photo-1563612116625-3012372fccce?w=400&q=80&hr9	Hot Roll	t	0	none	0
217	Green Matcha Iced	4.50	https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&q=80&dr1	Drink	t	0	none	0
218	Ramune Soda Melon	4.00	https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&dr2	Drink	t	0	none	0
219	Roasted Oolong Tea	3.50	https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80&dr3	Drink	f	0	none	0
220	Asahi Dry Beer	6.00	https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=400&q=80&dr4	Drink	f	0	none	0
221	Iced Calpico Chiller	4.00	https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80&dr5	Drink	t	0	none	0
167	California Classic Roll	6.50	https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80&roll1	Roll	t	0	none	0
223	Sapporo Draft Bottle	6.50	https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80&dr7	Drink	f	0	none	0
225	Japanese Plum Wine	9.00	https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80&dr9	Drink	f	0	none	0
228	Traditional Tekka	5.50	https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80&mk2	Maki	t	0	none	0
229	Avocado Green Maki	4.50	https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=80&mk3	Maki	f	0	none	0
230	Hamachi Scallion	6.00	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&mk4	Maki	f	0	none	0
231	Oshinko Radish Maki	4.00	https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400&q=80&mk5	Maki	f	0	none	0
235	Salmon Skin Maki	5.00	https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=400&q=80&mk9	Maki	f	0	none	0
237	Miso Ramen Classic	12.50	https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80&rm1	Ramen	t	0	none	0
238	Shoyu Black Ramen	12.00	https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=80&rm2	Ramen	f	0	none	0
240	Spicy Garlic Blast	14.00	https://images.unsplash.com/photo-1623341214825-9f4f963727da?w=400&q=80&rm4	Ramen	t	0	none	0
242	Kyoto Shio Style	13.00	https://images.unsplash.com/photo-1600326145359-3a44909d1a39?w=400&q=80&rm6	Ramen	f	0	none	0
246	Tempura Shrimp Ramen	15.50	https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&q=80&rm10	Ramen	f	0	none	0
247	Aloha Ahi Bowl	15.50	https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&pk1	Poke	t	0	none	0
249	Shrimp Mayo Bowl	13.00	https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&pk3	Poke	f	0	none	0
250	Veggie Tofu Bliss	12.00	https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400&q=80&pk4	Poke	f	0	none	0
251	Octopus Garden Poke	14.50	https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&q=80&pk5	Poke	f	0	none	0
252	Rainbow Protein Poke	17.00	https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&q=80&pk6	Poke	t	0	none	0
253	Citrus Yellowtail Bowl	16.50	https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80&pk7	Poke	f	0	none	0
254	Teriyaki Chicken Poke	13.50	https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&pk8	Poke	t	0	none	0
255	Eel Avocado Poke	16.00	https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80&pk9	Poke	f	0	none	0
256	Spicy Scallop Bowl	16.50	https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80&pk10	Poke	f	0	none	0
257	Best Seller Gyoza	7.50	https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80&ms1	Most Sales	t	0	none	0
258	Famous Edamame Bowl	5.00	https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80&ms2	Most Sales	t	0	none	0
260	Top Seaweed Salad	6.50	https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&ms4	Most Sales	t	0	none	0
261	Prime Sashimi Mix	35.00	https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&q=80&ms5	Most Sales	t	0	none	0
262	Legendary Dragon Roll	16.00	https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=400&q=80&ms6	Most Sales	t	0	none	0
263	Hot Hit Yakisoba	12.00	https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=80&ms7	Most Sales	t	0	none	0
265	Popular Green Tea	3.50	https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&q=80&ms9	Most Sales	t	0	none	0
266	Massive Sushi Boat	50.00	https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&ms10	Most Sales	t	0	none	0
192	Fatty Salmon Belly	6.00	https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=500&q=80&sig=salmon_belly	Sushi	t	0	none	0
207	Volcano Lava Roll	14.50	https://images.unsplash.com/photo-1558985250-27a406d64cb3?w=500&q=80&sig=lava_roll	Hot Roll	t	0	none	0
\.


--
-- Data for Name: stock_request_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_request_items (id, stock_request_id, item_name, category, quantity) FROM stdin;
\.


--
-- Data for Name: stock_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_requests (id, user_id, location_name, status, created_at) FROM stdin;
\.


--
-- Data for Name: stocks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stocks (id, name, category, quantity, unit, image_url) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, role, created_at, assigned_location_id) FROM stdin;
3	thavireak27@gmail.com	google	user	2025-12-20 19:07:38.331812	\N
4	vireak@gmail.com	$2b$10$qS8E9YP57716o0c9QwD9JuQMz2a/QQR4rik32d8LQwSVgnNGOCBGa	user	2025-12-20 19:26:42.76743	\N
2	account@gmail.com	$2b$10$NznM.op..87keL2AwtdRr.9/erdiG52b2uzz/bju.Icml8zeBSlFK	manager	2025-12-20 18:41:43.033534	\N
5	local1@gmail.com	$2b$10$1JcgX6cM8NcSQXAXd5ByM.EW1QhBcaAg7mpMV6O9E1/4loVTuTaRy	store_manager	2025-12-22 14:19:03.027452	1
6	local2@gmail.com	$2b$10$69iGfNBm3AvQv9wcjsRayuqw7LFNhyJM5qjGVKuh10JEfjUL0oBYa	store_manager	2025-12-22 14:19:17.471243	2
9	staff1@gmail.com	$2b$10$ozpCu2U8S3O4DqwMVdbF7.lMjCVlc2R1OKdku.R62X49auSsIbI2i	staff	2025-12-22 15:09:06.902121	1
10	staff2@gmail.com	$2b$10$T8Qg3utz1DBy6/rhZYwiPuBBpD29FvkFPVDDrUYUp4f5jtVKo1nL6	staff	2025-12-22 15:09:16.893167	2
11	vireak2@gmail.com	$2b$10$sS1LhZMVTY.hpzmIwx9iFuN0t7gKhRRbZFXYh6U1co/vn.xg4w8AO	user	2025-12-23 11:08:33.113433	\N
\.


--
-- Name: cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cart_id_seq', 23, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 12, true);


--
-- Name: daily_inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_inventory_items_id_seq', 1, false);


--
-- Name: daily_inventory_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.daily_inventory_logs_id_seq', 1, false);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locations_id_seq', 2, true);


--
-- Name: monthly_sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.monthly_sales_id_seq', 12, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 20, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 14, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 266, true);


--
-- Name: stock_request_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_request_items_id_seq', 1, false);


--
-- Name: stock_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_requests_id_seq', 1, false);


--
-- Name: stocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stocks_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 11, true);


--
-- Name: cart cart_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: daily_inventory_items daily_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_inventory_items
    ADD CONSTRAINT daily_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: daily_inventory_logs daily_inventory_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_inventory_logs
    ADD CONSTRAINT daily_inventory_logs_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: monthly_sales monthly_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_sales
    ADD CONSTRAINT monthly_sales_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: stock_request_items stock_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_pkey PRIMARY KEY (id);


--
-- Name: stock_requests stock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_pkey PRIMARY KEY (id);


--
-- Name: stocks stocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT stocks_pkey PRIMARY KEY (id);


--
-- Name: categories unique_categories_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT unique_categories_name UNIQUE (name);


--
-- Name: products unique_product_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT unique_product_name UNIQUE (name);


--
-- Name: products unique_products_image_url; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT unique_products_image_url UNIQUE (name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: cart cart_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart cart_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart
    ADD CONSTRAINT cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_inventory_items daily_inventory_items_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_inventory_items
    ADD CONSTRAINT daily_inventory_items_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.daily_inventory_logs(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock_request_items stock_request_items_stock_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_items
    ADD CONSTRAINT stock_request_items_stock_request_id_fkey FOREIGN KEY (stock_request_id) REFERENCES public.stock_requests(id) ON DELETE CASCADE;


--
-- Name: stock_requests stock_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict bTnDI1dghl1oLLOahOJh8iha1kMMe3hBoczZ3ABLghNbJyWHcmSYRgxlt8amYAN

