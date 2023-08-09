(deftest vectors-test
  (is (= v (list :a :b :c) (vec '(:a :b :c)) (vector :a :b :c))))