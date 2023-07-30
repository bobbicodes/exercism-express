(ns core {:clj-kondo/ignore true})

(def not (fn [a] (if a false true)))

(defmacro cond 
  (fn [& xs] 
    (if (> (count xs) 0) 
      (list 'if (first xs) 
            (if (> (count xs) 1)
              (nth xs 1) (throw \\"odd number of forms to cond \\")) 
            (cons 'cond (rest (rest xs)))))))

(def dec (fn (a) (- a 1)))
(def zero? (fn (n) (= 0 n)))
(def identity (fn (x) x))
(def reduce
  (fn (f init xs)
    (if (empty? xs)
      init
      (reduce f (f init (first xs)) (rest xs)))))

(def _iter-> 
  (fn [acc form] 
    (if (list? form) `(~(first form) ~acc ~@(rest form)) (list form acc))))

(defmacro -> (fn (x & xs) (reduce _iter-> x xs)))

(def _iter->> (fn [acc form] (if (list? form) `(~(first form) ~@(rest form) ~acc) (list form acc))))

(defmacro ->> (fn (x & xs) (reduce _iter->> x xs)))

(def gensym
  (let [counter (atom 0)]
    (fn []
      (symbol (str \\"G__\\" (swap! counter inc))))))

(defmacro or (fn (& xs) (if (empty? xs) nil (if (= 1 (count xs)) (first xs) (let (condvar (gensym)) `(let (~condvar ~(first xs)) (if ~condvar ~condvar (or ~@(rest xs)))))))))

(def memoize
  (fn [f]
    (let [mem (atom {})]
      (fn [& args]
        (let [key (str args)]
          (if (contains? @mem key)
            (get @mem key)
            (let [ret (apply f args)]
              (do
                (swap! mem assoc key ret)
                ret))))))))

(def partial (fn [pfn & args]
               (fn [& args-inner]
                 (apply pfn (concat args args-inner)))))

(def every?
  (fn (pred xs)
    (cond (empty? xs)       true
          (pred (first xs)) (every? pred (rest xs))
          true              false)))

(defn reverse [coll] (reduce conj () coll))

(defmacro when (fn [x & xs] (list 'if x (cons 'do xs))))

(defn and [& forms] (every? true? forms))

(def some (fn (pred xs) (if (empty? xs) nil (or (pred (first xs)) (some pred (rest xs))))))

(defmacro time
  (fn (exp)
    (let [start (gensym)
          ret   (gensym)]
      `(let (~start (time-ms)
                      ~ret   ~exp)
           (str
            \\"(Elapsed time: \\" (- (time-ms) ~start) \\"msecs) \\" ~ret)))))

(def load-file (fn (f) (eval (read-string (str \\"(do \\" (slurp f) \\"\nnil)\\")))))
